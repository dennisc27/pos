import { createWorker } from 'tesseract.js';

export type ExtractedIdData = {
  firstName?: string;
  lastName?: string;
  cedulaNo?: string;
  dateOfBirth?: string;
  address?: string; // Address extracted from reverse side (DIRECCION DE RESIDENCIA)
  error?: string; // Error message if extraction failed or data is incomplete
};

/**
 * Crops an image to a specific region (for reverse side address extraction)
 * @param imageFile - The image file to crop
 * @param x - X coordinate (0-1, relative to image width)
 * @param y - Y coordinate (0-1, relative to image height)
 * @param width - Width (0-1, relative to image width)
 * @param height - Height (0-1, relative to image height)
 */
function cropImageRegion(
  imageFile: File,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageFile);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      // Calculate absolute coordinates
      const cropX = Math.floor(img.width * x);
      const cropY = Math.floor(img.height * y);
      const cropWidth = Math.floor(img.width * width);
      const cropHeight = Math.floor(img.height * height);
      
      // Set canvas size to cropped dimensions
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      
      // Draw the cropped portion of the image
      ctx.drawImage(
        img,
        cropX, cropY, cropWidth, cropHeight, // Source rectangle
        0, 0, cropWidth, cropHeight // Destination rectangle
      );
      
      // Convert canvas to blob, then to File
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (!blob) {
          reject(new Error('Failed to create blob'));
          return;
        }
        const croppedFile = new File([blob], imageFile.name, { type: 'image/png' });
        resolve(croppedFile);
      }, 'image/png');
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

/**
 * Preprocesses image to extract only black/dark text by filtering out light background
 * @param imageFile - The image file to process
 * @param threshold - Brightness threshold (default: 100). Higher values preserve more text.
 */
function preprocessImageForBlackText(imageFile: File, threshold: number = 100): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageFile);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw the image
      ctx.drawImage(img, 0, 0);
      
      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Process each pixel
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Calculate brightness (luminance)
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
        
        // Threshold: keep only dark pixels (black text)
        // Pixels with brightness < threshold are considered black/dark text
        // Pixels with brightness >= threshold are considered background (set to white)
        if (brightness >= threshold) {
          // Make it white (remove light background)
          data[i] = 255;     // R
          data[i + 1] = 255; // G
          data[i + 2] = 255; // B
          // Keep alpha as is
        }
        // Dark pixels (black text) are kept as is
      }
      
      // Put processed image data back
      ctx.putImageData(imageData, 0, 0);
      
      // Convert canvas to blob, then to File
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (!blob) {
          reject(new Error('Failed to create blob'));
          return;
        }
        const processedFile = new File([blob], imageFile.name, { type: 'image/png' });
        resolve(processedFile);
      }, 'image/png');
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

/**
 * Extracts text from an ID card image using OCR
 * Preprocesses image to only extract black/dark text
 * @param imageFile - The image file to process
 * @param isReverseSide - Whether this is the reverse side (uses different OCR settings)
 */
export async function extractTextFromImage(imageFile: File, isReverseSide: boolean = false): Promise<string> {
  const worker = await createWorker('spa'); // Spanish language
  try {
    // For reverse side, crop to the address region first
    let imageToProcess: File;
    if (isReverseSide) {
      // Crop to the address region (middle-left area, below "UBICACION DEL COLEGIO")
      // Based on typical ID card layout:
      // - X: 0% from left (start from the very beginning to capture full text, including first characters)
      // - Y: 35% from top (below "UBICACION DEL COLEGIO" section, where "DIRECCION DE RESIDENCIA" starts)
      // - Width: 60% of image (covers left side where address is, avoiding right side barcodes)
      // - Height: 35% of image (covers the address section with some margin)
      console.log('Cropping reverse side image to address region...');
      imageToProcess = await cropImageRegion(imageFile, 0.0, 0.35, 0.60, 0.35);
    } else {
      imageToProcess = imageFile;
    }
    
    // For reverse side, use less aggressive preprocessing to preserve more text
    let processedImage: File;
    if (isReverseSide) {
      // For reverse side, try with a higher threshold to preserve more text
      processedImage = await preprocessImageForBlackText(imageToProcess, 120); // Higher threshold
    } else {
      // For front side, use standard preprocessing
      processedImage = await preprocessImageForBlackText(imageToProcess);
    }
    
    // Use different OCR settings for reverse side
    // Note: We'll rely on the preprocessing and default OCR settings
    // The higher threshold in preprocessing should help preserve more text
    
    const { data: { text } } = await worker.recognize(processedImage);
    
    // Debug: Log the extracted text
    console.log('=== RAW OCR TEXT EXTRACTION ===');
    console.log('Full text:', text);
    console.log('Text lines:', text.split('\n').map((line, i) => `${i}: "${line}"`));
    console.log('================================');
    
    return text;
  } finally {
    await worker.terminate();
  }
}

/**
 * Parses OCR text to extract ID card information
 * Based on Dominican Republic ID card format
 */
export function parseIdCardData(ocrText: string): Partial<ExtractedIdData> {
  const text = ocrText.toUpperCase();
  const result: Partial<ExtractedIdData> = {};
  
  // Debug: Log the text being parsed
  console.log('=== PARSING OCR TEXT ===');
  console.log('Uppercase text:', text);
  console.log('Text lines (parsed):', text.split('\n').map((line, i) => `${i}: "${line.trim()}"`));
  console.log('========================');

  // Extract Cédula number (format: XXX-XXXXXXX-X)
  const cedulaMatch = text.match(/\b(\d{3}[-]?\d{7}[-]?\d{1})\b/);
  if (cedulaMatch) {
    result.cedulaNo = cedulaMatch[1].replace(/-/g, '');
  }

  // Function to normalize OCR errors in month names
  function normalizeMonthName(monthText: string): string | null {
    const monthTextUpper = monthText.toUpperCase();
    
    // Direct matches
    const monthMap: Record<string, string> = {
      'ENERO': '01', 'FEBRERO': '02', 'MARZO': '03', 'ABRIL': '04',
      'MAYO': '05', 'JUNIO': '06', 'JULIO': '07', 'AGOSTO': '08',
      'SEPTIEMBRE': '09', 'OCTUBRE': '10', 'NOVIEMBRE': '11', 'DICIEMBRE': '12'
    };
    
    if (monthMap[monthTextUpper]) {
      return monthMap[monthTextUpper];
    }
    
    // Handle common OCR errors
    // A60STO -> AGOSTO (6 looks like G, 0 looks like O)
    if (/A[6G]0?STO/i.test(monthTextUpper) || /A[6G][0O]STO/i.test(monthTextUpper)) {
      return '08'; // AGOSTO
    }
    // A6OSTO -> AGOSTO
    if (/A6OSTO/i.test(monthTextUpper)) {
      return '08';
    }
    // Other common OCR errors for months
    if (/M[4A]RZO/i.test(monthTextUpper)) return '03'; // MARZO (4 looks like A)
    if (/EN[6E]RO/i.test(monthTextUpper)) return '01'; // ENERO (6 looks like E)
    if (/F[6E]BRERO/i.test(monthTextUpper)) return '02'; // FEBRERO
    if (/ABR[1I]L/i.test(monthTextUpper)) return '04'; // ABRIL (1 looks like I)
    if (/MAY[0O]/i.test(monthTextUpper)) return '05'; // MAYO
    if (/JUN[1I]O/i.test(monthTextUpper)) return '06'; // JUNIO
    if (/JUL[1I]O/i.test(monthTextUpper)) return '07'; // JULIO
    if (/SEPTIEMBRE/i.test(monthTextUpper)) return '09';
    if (/OCTUBRE/i.test(monthTextUpper)) return '10';
    if (/NOVIEMBRE/i.test(monthTextUpper)) return '11';
    if (/DICIEMBRE/i.test(monthTextUpper)) return '12';
    
    return null;
  }

  // Extract date of birth (format: DD MES YYYY or DD/MM/YYYY)
  // Handle OCR errors like "A60STO" -> "AGOSTO", "200" -> "2002"
  const datePatterns = [
    // Pattern with flexible month matching (handles OCR errors)
    /(\d{1,2})\s+([A-Z0-9]{4,12})\s+(\d{3,4})/i,
    // Pattern with explicit month names
    /(\d{1,2})\s+(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s+(\d{4})/i,
    // Pattern with FECHA DE NACIMIENTO label
    /FECHA\s+DE\s+NACIMIENTO[:\s]+(\d{1,2})\s+([A-Z0-9]{4,12})\s+(\d{3,4})/i,
    // Date format (e.g., "03/03/1976")
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      const day = match[1].padStart(2, '0');
      let month: string | null = null;
      let year = match[3];
      
      // If it's a month name pattern (has letters)
      if (match[2] && /[A-Z]/.test(match[2])) {
        month = normalizeMonthName(match[2]);
        
        // If month normalization failed, try to fix common OCR errors
        if (!month) {
          // Try to fix the month name by replacing common OCR errors
          let fixedMonth = match[2].toUpperCase()
            .replace(/6/g, 'G')  // 6 looks like G
            .replace(/0/g, 'O')  // 0 looks like O (but be careful)
            .replace(/1/g, 'I')  // 1 looks like I
            .replace(/4/g, 'A'); // 4 looks like A
          
          month = normalizeMonthName(fixedMonth);
        }
        
        // If still no month, try direct lookup with original text
        if (!month) {
          month = normalizeMonthName(match[2]);
        }
        
        // Validate year - must be exactly 4 digits
        if (year.length !== 4) {
          result.error = `El año de nacimiento no se pudo extraer correctamente (se encontró: "${year}"). Por favor, ingresa la fecha de nacimiento manualmente.`;
          console.warn(`Invalid year length: ${year.length} (expected 4)`);
          break;
        }
        
        // Validate year is reasonable (between 1900 and current year + 1)
        const yearNum = parseInt(year);
        const currentYear = new Date().getFullYear();
        if (isNaN(yearNum) || yearNum < 1900 || yearNum > currentYear + 1) {
          result.error = `El año de nacimiento no es válido (se encontró: "${year}"). Por favor, ingresa la fecha de nacimiento manualmente.`;
          console.warn(`Invalid year value: ${year}`);
          break;
        }
        
        // Validate month was successfully normalized
        if (!month) {
          result.error = `El mes de nacimiento no se pudo extraer correctamente (se encontró: "${match[2]}"). Por favor, ingresa la fecha de nacimiento manualmente.`;
          console.warn(`Could not normalize month: ${match[2]}`);
          break;
        }
        
        // Validate day is reasonable (1-31)
        const dayNum = parseInt(day);
        if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
          result.error = `El día de nacimiento no es válido (se encontró: "${day}"). Por favor, ingresa la fecha de nacimiento manualmente.`;
          console.warn(`Invalid day value: ${day}`);
          break;
        }
        
        // Format as YYYY-MM-DD for HTML date input
        result.dateOfBirth = `${year}-${month}-${day}`;
        console.log(`✓ Extracted date: ${match[0]} -> ${result.dateOfBirth}`);
        break;
      } else {
        // Date format (e.g., "03/03/1976")
        const monthNum = match[2].padStart(2, '0');
        const monthInt = parseInt(monthNum);
        const dayNum = parseInt(day);
        
        // Validate month (1-12)
        if (isNaN(monthInt) || monthInt < 1 || monthInt > 12) {
          result.error = `El mes de nacimiento no es válido (se encontró: "${monthNum}"). Por favor, ingresa la fecha de nacimiento manualmente.`;
          console.warn(`Invalid month value: ${monthNum}`);
          break;
        }
        
        // Validate day (1-31)
        if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
          result.error = `El día de nacimiento no es válido (se encontró: "${day}"). Por favor, ingresa la fecha de nacimiento manualmente.`;
          console.warn(`Invalid day value: ${day}`);
          break;
        }
        
        // Validate year - must be exactly 4 digits
        if (year.length !== 4) {
          result.error = `El año de nacimiento no se pudo extraer correctamente (se encontró: "${year}"). Por favor, ingresa la fecha de nacimiento manualmente.`;
          console.warn(`Invalid year length: ${year.length} (expected 4)`);
          break;
        }
        
        // Validate year is reasonable (between 1900 and current year + 1)
        const yearNum = parseInt(year);
        const currentYear = new Date().getFullYear();
        if (isNaN(yearNum) || yearNum < 1900 || yearNum > currentYear + 1) {
          result.error = `El año de nacimiento no es válido (se encontró: "${year}"). Por favor, ingresa la fecha de nacimiento manualmente.`;
          console.warn(`Invalid year value: ${year}`);
          break;
        }
        
        // Format as YYYY-MM-DD for HTML date input
        result.dateOfBirth = `${year}-${monthNum}-${day}`;
        console.log(`✓ Extracted date: ${match[0]} -> ${result.dateOfBirth}`);
        break;
      }
    }
  }

  // Extract name - appears at the bottom left of the card in two lines
  // First line: First name (e.g., "MARINO") - can have multiple names
  // Second line: Last name (e.g., "FULGENCIO QUEZADA") - can have multiple last names
  // IMPORTANT: Always take the absolute LAST 2 lines from OCR output
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  console.log('All lines from OCR:', lines.map((line, i) => `${i}: "${line}"`));
  
  // Function to clean OCR artifacts from a line
  function cleanNameLine(line: string): string {
    return line
      // Remove common OCR artifacts and special characters
      .replace(/["«»»«\-\.\*\+]/g, '') // Remove quotes, dashes, dots, asterisks, plus signs
      .replace(/^[^A-ZÁÉÍÓÚÑ]+/g, '') // Remove leading non-letter characters (like "«u")
      .replace(/[^A-ZÁÉÍÓÚÑ\s]+$/g, '') // Remove trailing non-letter characters (like "E.")
      .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
      .trim()
      .toUpperCase();
  }
  
  // Filter out lines that are clearly not names (field labels, dates, etc.)
  const excludePatterns = [
    /REPUBLICA|DOMINICANA|JUNTA|CENTRAL|ELECTORAL|CEDULA|IDENTIDAD/i,
    /LUGAR\s+DE\s+NACIMIENTO/i,
    /FECHA\s+DE\s+NACIMIENTO/i,
    /NACIONALIDAD/i,
    /SEXO|SANGRE|ESTADO\s+CIVIL|OCUPACI[OÓ]N/i,
    /FECHA\s+DE\s+EXPIRACI[OÓ]N/i,
    /^\d{3}[-]?\d{7}[-]?\d{1}$/, // Cedula number pattern
    /EL\s+VALLE|R\.D\.|SANTO\s+DOMINGO|SANTIAGO/i, // Common places of birth
    /COMERCIANTE|ESTUDIANTE|PROFESOR|MEDICO|INGENIERO|ABOGADO|ENFERMERO/i, // Common occupations
    /SOLTERO|CASADO|DIVORCIADO|VIUDO|UNION\s+LIBRE/i, // Marital status
    /B\+|A\+|O\+|AB\+|AB-/i, // Blood type
    /^M$|^F$/i, // Sex (single letter M or F)
    /MARZO|ENERO|FEBRERO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE/i, // Month names
    /^\d{1,2}\s+(MARZO|ENERO|FEBRERO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s+\d{4}$/i, // Dates
  ];

  // Function to check if a line is likely an OCR artifact (not a real name)
  function isLikelyArtifact(line: string): boolean {
    const cleaned = cleanNameLine(line);
    // Very short lines (1-2 chars) are likely artifacts
    if (cleaned.length <= 2) return true;
    // Lines with mostly special characters (less than 30% letters)
    const letterCount = (cleaned.match(/[A-ZÁÉÍÓÚÑ]/g) || []).length;
    if (letterCount < cleaned.length * 0.3) return true;
    // Lines that are just single letters or very short words
    const words = cleaned.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return true;
    if (words.length === 1 && words[0].length <= 2) return true;
    // Lines with only 1-2 letter words (like "UA")
    if (words.length > 0 && words.every(w => w.length <= 2)) return true;
    return false;
  }
  
  // Take the last 5-6 lines to account for trailing OCR artifacts
  const lastLines = lines.slice(-6);
  console.log('Last 6 lines from OCR:', lastLines.map((line, i) => `${i}: "${line}"`));
  
  // Filter out artifact lines and exclusion patterns
  const validNameLines = lastLines
    .map(line => ({ original: line, cleaned: cleanNameLine(line) }))
    .filter(({ cleaned }) => {
      // Skip if it's an artifact
      if (isLikelyArtifact(cleaned)) return false;
      // Skip if it matches exclusion patterns
      if (excludePatterns.some(pattern => pattern.test(cleaned))) return false;
      // Must be a reasonable name length
      if (cleaned.length < 2 || cleaned.length > 40) return false;
      // Must contain at least one word with 3+ letters (real names)
      const words = cleaned.split(/\s+/).filter(w => w.length > 0);
      if (!words.some(w => w.length >= 3)) return false;
      return true;
    });
  
  console.log('Valid name lines (after filtering):', validNameLines.map(({ original, cleaned }) => `"${original}" -> "${cleaned}"`));
  
  if (validNameLines.length >= 2) {
    // Take the last 2 valid name lines
    const lastTwo = validNameLines.slice(-2);
    let line1 = lastTwo[0].cleaned;
    let line2 = lastTwo[1].cleaned;
    
    // Remove single-letter words (OCR artifacts like "E")
    line1 = line1.split(/\s+/).filter(word => word.length > 1).join(' ');
    line2 = line2.split(/\s+/).filter(word => word.length > 1).join(' ');
    
    console.log('Final cleaned lines:', { line1, line2 });
    
    if (line1.length >= 2 && line2.length >= 3) {
      // Use the order: first valid line = first name, second valid line = last name
      result.firstName = line1;
      result.lastName = line2;
      console.log('✓ Found name from last 2 valid lines:', result.firstName, result.lastName);
    }
  } else if (validNameLines.length === 1) {
    // Only one valid line - try to split it
    let cleaned = validNameLines[0].cleaned;
    cleaned = cleaned.split(/\s+/).filter(word => word.length > 1).join(' ');
    const words = cleaned.split(/\s+/).filter(w => w.length > 1);
    if (words.length >= 2) {
      // First word(s) = first name, rest = last name
      result.firstName = words[0];
      result.lastName = words.slice(1).join(' ');
      console.log('✓ Split single valid line:', result.firstName, result.lastName);
    }
  } else {
    // Fallback: try the absolute last 2 lines with aggressive cleaning
    const absoluteLastTwo = lines.slice(-2);
    console.log('Fallback: Trying absolute last 2 lines:', absoluteLastTwo);
    
    let line1 = cleanNameLine(absoluteLastTwo[0] || '');
    let line2 = cleanNameLine(absoluteLastTwo[1] || '');
    
    // Remove single-letter words
    line1 = line1.split(/\s+/).filter(word => word.length > 1).join(' ');
    line2 = line2.split(/\s+/).filter(word => word.length > 1).join(' ');
    
    // Check if they look like names (not artifacts)
    const line1Valid = line1.length >= 2 && line1.length <= 40 && /^[A-ZÁÉÍÓÚÑ\s]+$/.test(line1) && !isLikelyArtifact(line1);
    const line2Valid = line2.length >= 3 && line2.length <= 40 && /^[A-ZÁÉÍÓÚÑ\s]+$/.test(line2) && !isLikelyArtifact(line2);
    
    if (line1Valid && line2Valid) {
      result.firstName = line1;
      result.lastName = line2;
      console.log('✓ Fallback: Using absolute last 2 lines:', result.firstName, result.lastName);
    } else if (line2Valid && line2.split(/\s+/).length >= 2) {
      // Only line2 is valid, try to split it
      const words = line2.split(/\s+/).filter(w => w.length > 1);
      if (words.length >= 2) {
        result.firstName = words[0];
        result.lastName = words.slice(1).join(' ');
        console.log('✓ Fallback: Split line2:', result.firstName, result.lastName);
      }
    }
  }
  
  // Validate extracted data
  if (!result.firstName || !result.lastName) {
    if (!result.error) {
      result.error = 'No se pudieron extraer el nombre y apellido de la imagen. Por favor, ingresa esta información manualmente.';
    }
    console.warn('⚠ Could not extract name. Last lines:', lines.slice(-6));
  }
  
  // Validate date of birth format if extracted
  if (result.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(result.dateOfBirth)) {
    if (!result.error) {
      result.error = `La fecha de nacimiento no se pudo extraer correctamente (se encontró: "${result.dateOfBirth}"). Por favor, ingresa la fecha de nacimiento manualmente.`;
    }
    console.warn(`Invalid date format: ${result.dateOfBirth}`);
  }

  return result;
}

/**
 * Parses OCR text from the reverse side of the ID card to extract address information
 */
function parseReverseSideData(ocrText: string): Partial<ExtractedIdData> {
  const text = ocrText.toUpperCase();
  const result: Partial<ExtractedIdData> = {};
  
  console.log('=== PARSING REVERSE SIDE OCR TEXT ===');
  console.log('Uppercase text:', text);
  console.log('====================================');
  
  // Look for "DIRECCION DE RESIDENCIA" section
  // Pattern: "DIRECCION DE RESIDENCIA" followed by address components
  // The address typically appears as:
  // - First line: Province/Region (e.g., "DUARTE")
  // - Second line: Sector (e.g., "SECTOR RINCON" or just "RINCON")
  // - Third line: Municipality (e.g., "MUNICIPIO JIMA ABAJO" or "JIMA ABAJO")
  
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  console.log('All lines from reverse side OCR:', lines.map((line, i) => `${i}: "${line}"`));
  
  let foundDireccion = false;
  const addressParts: string[] = [];
  
  // Try multiple patterns to find "DIRECCION DE RESIDENCIA"
  // Sometimes OCR might read it as "DIRECCION", "RESIDENCIA", or with OCR errors
  const direccionPatterns = [
    /DIRECCION\s+DE\s+RESIDENCIA/i,
    /DIRECCION\s+RESIDENCIA/i,
    /DIRECCION/i,
    /RESIDENCIA/i,
    /DIRECCI[OÓ]N/i, // Handle OCR errors
  ];
  
  // Find "DIRECCION DE RESIDENCIA" line (try multiple patterns)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if we found any variation of "DIRECCION DE RESIDENCIA"
    const matchesPattern = direccionPatterns.some(pattern => pattern.test(line));
    
    if (matchesPattern) {
      foundDireccion = true;
      console.log(`Found DIRECCION DE RESIDENCIA pattern at line ${i}: "${line}"`);
      
      // Look at the next 2-5 lines for address components (more lines in case OCR split them)
      // Usually: Province, Sector, Municipality
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const addrLine = lines[j];
        console.log(`  Checking line ${j}: "${addrLine}"`);
        
        // Skip if it looks like a label or other field
        if (/^(CEDULA|COLEGIO|UBICACION|REGISTRO|CODIGO|PRESIDENTE|JCE|CEDULA ANT|IDDOM|FULGENCIO|MARINO|CENTRO EDUCATIVO)/i.test(addrLine)) {
          console.log(`  Skipping line ${j} (looks like a label or MRZ)`);
          continue;
        }
        
        // Skip lines that are just single characters, equals signs, or mostly special characters
        if (/^[^A-ZÁÉÍÓÚÑ0-9]*[=-E][^A-ZÁÉÍÓÚÑ0-9]*$/i.test(addrLine) || addrLine.length <= 2) {
          console.log(`  Skipping line ${j} (garbage: "${addrLine}")`);
          continue;
        }
        
        // Skip MRZ lines (machine readable zone at bottom)
        if (/^[A-Z0-9<]+$/.test(addrLine) && addrLine.length > 20 && /<{3,}/.test(addrLine)) {
          console.log(`  Skipping line ${j} (looks like MRZ)`);
          continue;
        }
        
        // Skip lines that are mostly special characters or numbers
        const letterCount = (addrLine.match(/[A-ZÁÉÍÓÚÑ]/g) || []).length;
        if (letterCount < addrLine.length * 0.3 || letterCount < 3) {
          console.log(`  Skipping line ${j} (too few letters: ${letterCount}/${addrLine.length})`);
          continue;
        }
        
        // Remove common prefixes and clean
        let cleaned = addrLine
          .replace(/^SECTOR\s+/i, '') // Remove "SECTOR" prefix
          .replace(/^MUNICIPIO\s+/i, '') // Remove "MUNICIPIO" prefix
          .replace(/^PROVINCIA\s+/i, '') // Remove "PROVINCIA" prefix
          .replace(/^DM\s+/i, '') // Remove "DM" prefix (Distrito Municipal)
          .replace(/^R\.D\.\s*/i, '') // Remove "R.D." prefix
          .replace(/[<>]+/g, '') // Remove MRZ angle brackets
          .replace(/[^A-ZÁÉÍÓÚÑ0-9\s,.-]/g, '') // Remove special characters except common ones
          .trim();
        
        // Skip if empty or too short, or if it's just numbers/special chars
        if (cleaned.length >= 2 && /[A-ZÁÉÍÓÚÑ]/.test(cleaned)) {
          // Don't add duplicates
          if (!addressParts.includes(cleaned)) {
            addressParts.push(cleaned);
            console.log(`  ✓ Added address part: "${cleaned}"`);
          }
        } else {
          console.log(`  Skipping line ${j} (too short or invalid: "${cleaned}")`);
        }
        
        // Stop if we've found enough address parts (typically 3: province, sector, municipality)
        if (addressParts.length >= 3) {
          break;
        }
      }
      break;
    }
  }
  
  // If we didn't find "DIRECCION DE RESIDENCIA" but have some valid-looking address lines,
  // try to extract from lines that look like addresses (not MRZ, not labels)
  if (!foundDireccion && addressParts.length === 0) {
    console.log('Trying alternative extraction: looking for address-like lines');
    
    const candidateParts: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip MRZ lines, labels, and garbage
      if (/^(IDDOM|CEDULA|COLEGIO|UBICACION|REGISTRO|CODIGO|PRESIDENTE|JCE|FULGENCIO|MARINO|CENTRO EDUCATIVO)/i.test(line)) {
        continue;
      }
      
      // Skip lines that are just single characters, equals signs, or mostly special characters
      if (/^[^A-ZÁÉÍÓÚÑ0-9]*[=-E][^A-ZÁÉÍÓÚÑ0-9]*$/i.test(line) || line.length <= 2) {
        continue;
      }
      
      // Skip MRZ format lines
      if (/^[A-Z0-9<]+$/.test(line) && line.length > 20 && /<{3,}/.test(line)) {
        continue;
      }
      
      // Skip lines with mostly special characters
      const letterCount = (line.match(/[A-ZÁÉÍÓÚÑ]/g) || []).length;
      if (letterCount < line.length * 0.3 || letterCount < 3) {
        continue;
      }
      
      // Clean the line
      let cleaned = line
        .replace(/^SECTOR\s+/i, '')
        .replace(/^MUNICIPIO\s+/i, '')
        .replace(/^PROVINCIA\s+/i, '')
        .replace(/^DM\s+/i, '')
        .replace(/^R\.D\.\s*/i, '')
        .replace(/[<>|]+/g, '') // Remove pipes and angle brackets
        .replace(/[^A-ZÁÉÍÓÚÑ0-9\s,.-]/g, '')
        .replace(/\s*-\s*$/, '') // Remove trailing dashes
        .trim();
      
      // If it looks like a valid address component
      if (cleaned.length >= 2 && /[A-ZÁÉÍÓÚÑ]/.test(cleaned) && !candidateParts.includes(cleaned)) {
        candidateParts.push(cleaned);
        console.log(`  ✓ Found candidate address part: "${cleaned}"`);
      }
    }
    
    // Try to identify and order the address parts
    // Typically: Province (single word, often all caps), Sector, Municipality
    // Look for "DUARTE" (province), "RINCON" (sector), "JIMA ABAJO" (municipality)
    
    // Find province (usually a single word, common provinces: DUARTE, SANTO DOMINGO, etc.)
    const province = candidateParts.find(p => 
      /^(DUARTE|SANTO DOMINGO|SANTIAGO|LA VEGA|SAN CRISTOBAL|PUERTO PLATA|SAN PEDRO|LA ROMANA|BARAHONA|AZUA)$/i.test(p)
    ) || candidateParts.find(p => p.split(/\s+/).length === 1 && p.length >= 4);
    
    // Find sector (usually contains "RINCON" or similar)
    const sector = candidateParts.find(p => 
      /RINCON/i.test(p) || /SECTOR/i.test(p)
    ) || candidateParts.find(p => p.split(/\s+/).length === 1 && p.length >= 4 && p !== province);
    
    // Find municipality (usually 2+ words, like "JIMA ABAJO")
    const municipality = candidateParts.find(p => 
      /JIMA/i.test(p) || /ABAJO/i.test(p) || (p.split(/\s+/).length >= 2 && p !== sector && p !== province)
    ) || candidateParts.find(p => p.split(/\s+/).length >= 2);
    
    // Build address in correct order: Province, Sector, Municipality
    if (province) addressParts.push(province);
    if (sector && sector !== province) addressParts.push(sector);
    if (municipality && municipality !== sector && municipality !== province) addressParts.push(municipality);
    
    // If we still don't have 3 parts, add remaining candidates
    for (const part of candidateParts) {
      if (addressParts.length >= 3) break;
      if (!addressParts.includes(part)) {
        addressParts.push(part);
      }
    }
    
    console.log('Ordered address parts:', addressParts);
  }
  
  if (addressParts.length > 0) {
    result.address = addressParts.join(', ');
    console.log('✓ Extracted address:', result.address);
  } else {
    console.warn('⚠ Could not extract address from reverse side');
  }
  
  return result;
}

/**
 * Main function to extract ID card data from an image file
 * @param imageFile - The image file to process (front or back)
 * @param isReverseSide - Whether this is the reverse side of the ID card
 */
export async function extractIdCardData(
  imageFile: File, 
  isReverseSide: boolean = false
): Promise<Partial<ExtractedIdData>> {
  const ocrText = await extractTextFromImage(imageFile, isReverseSide);
  
  if (isReverseSide) {
    return parseReverseSideData(ocrText);
  } else {
    return parseIdCardData(ocrText);
  }
}


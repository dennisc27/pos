# Layaway to Pawn Conversion Calculation
## Items and Paid Amount: RD$12,115.00

### Step 1: Calculate Item Values

| Item # | Product Name | Quantity | Unit Price | **Item Value** |
|--------|--------------|----------|------------|----------------|
| 1 | sad324 | 1 | RD$234.00 | **RD$234.00** |
| 2 | iPhone 14 Pro 256GB | 1 | RD$30,000.00 | **RD$30,000.00** |
| 3 | asdf | 1 | RD$234.00 | **RD$234.00** |
| 4 | iPhone 12 128GB Negro | 1 | RD$65,000.00 | **RD$65,000.00** |
| 5 | aasf asdf a | 1 | RD$10,000.00 | **RD$10,000.00** |
| **TOTAL** | | | | **RD$105,468.00** |

### Step 2: Calculate Proportional Paid Amounts (Raw)

| Item # | Item Value | Proportion | **Proportional Paid (Raw)** |
|--------|------------|------------|------------------------------|
| 1 | RD$234.00 | 0.002217 | RD$26.87 |
| 2 | RD$30,000.00 | 0.2843 | RD$3,444.33 |
| 3 | RD$234.00 | 0.002217 | RD$26.87 |
| 4 | RD$65,000.00 | 0.6167 | RD$7,471.41 |
| 5 | RD$10,000.00 | 0.0949 | RD$1,149.52 |
| **TOTAL** | **RD$105,468.00** | **1.0000** | **RD$12,115.00** ✓ |

### Step 3: Round to Nearest 50 Cents (Minimum 10 cents)

| Item # | Proportional Paid (Raw) | **Rounded to 50** | **After Adjustment** |
|--------|--------------------------|-------------------|----------------------|
| 1 | RD$26.87 | RD$50.00 | RD$50.00 |
| 2 | RD$3,444.33 | RD$3,450.00 | RD$3,450.00 |
| 3 | RD$26.87 | RD$50.00 | RD$50.00 |
| 4 | RD$7,471.41 | RD$7,450.00 | **RD$7,465.00** ⬅️ |
| 5 | RD$1,149.52 | RD$1,150.00 | RD$1,150.00 |
| **TOTAL** | **RD$12,115.00** | **RD$12,150.00** | **RD$12,115.00** ✓ |

**Rounding Difference**: RD$12,150.00 - RD$12,115.00 = **RD$35.00**
**Highest Value Item** (iPhone 12 128GB Negro) absorbs the difference:
- RD$7,450.00 - RD$35.00 = **RD$7,465.00**

### Step 4: Calculate Loan Principals (What's Still Owed)

| Item # | Product Name | Item Value | Proportional Paid | **Loan Principal** |
|--------|--------------|------------|-------------------|---------------------|
| 1 | sad324 | RD$234.00 | RD$50.00 | **RD$184.00** |
| 2 | iPhone 14 Pro 256GB | RD$30,000.00 | RD$3,450.00 | **RD$26,550.00** |
| 3 | asdf | RD$234.00 | RD$50.00 | **RD$184.00** |
| 4 | iPhone 12 128GB Negro | RD$65,000.00 | RD$7,465.00 | **RD$57,535.00** |
| 5 | aasf asdf a | RD$10,000.00 | RD$1,150.00 | **RD$8,850.00** |
| **TOTAL** | | **RD$105,468.00** | **RD$12,115.00** | **RD$93,353.00** |

**Verification**: RD$105,468.00 - RD$12,115.00 = **RD$93,353.00** ✓

### Step 5: Group Items into Loans (Max 4 items per loan)

#### **Loan 1: PAWN-000123** (Items 1-4)
- **Items**: 4 items
- **Principal**: **RD$84,453.00**
  - Item 1: sad324 - RD$184.00
  - Item 2: iPhone 14 Pro 256GB - RD$26,550.00
  - Item 3: asdf - RD$184.00
  - Item 4: iPhone 12 128GB Negro - RD$57,535.00

#### **Loan 2: PAWN-000124** (Item 5)
- **Items**: 1 item
- **Principal**: **RD$8,850.00**
  - Item 5: aasf asdf a - RD$8,850.00

### Summary

- **Total items value**: RD$105,468.00
- **Total paid**: RD$12,115.00
- **Total loan principals**: RD$93,353.00
- **Number of loans created**: 2
- **Loan 1 principal**: RD$84,453.00 (4 items)
- **Loan 2 principal**: RD$8,850.00 (1 item)


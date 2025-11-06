export type ReportDetailSection = {
  title: string;
  description: string;
  bullets?: string[];
};

export type ReportDetail = {
  overview: string;
  highlights: string[];
  sections: ReportDetailSection[];
};

export const REPORT_DETAILS: Record<string, ReportDetail> = {
  sales: {
    overview:
      "Monitor ventas brutas y netas para reaccionar rápido ante descuentos agresivos, devoluciones o falta de actividad en una sucursal.",
    highlights: [
      "Comparar ventas brutas vs. netas por día o sucursal",
      "Identificar métodos de pago predominantes y variaciones inusuales",
      "Revisar devoluciones o descuentos que afecten el margen"
    ],
    sections: [
      {
        title: "Filtros comunes",
        description: "Ajusta el rango de fechas y la sucursal para comparar periodos equivalentes.",
        bullets: ["Hoy, últimos 7 y 30 días", "Sucursales específicas o todas", "Ventas por canal (tienda, ecommerce, layaway)"]
      },
      {
        title: "Alertas que vigilar",
        description: "Busca cambios bruscos que requieran intervención del gerente.",
        bullets: [
          "Ticket promedio muy por debajo del objetivo",
          "Incremento en devoluciones frente a días previos",
          "Ventas en cero durante horas operativas"
        ]
      },
      {
        title: "Acciones sugeridas",
        description: "Coordina con marketing o piso de venta según el hallazgo.",
        bullets: [
          "Refuerza promociones en sucursales con bajo volumen",
          "Valida aperturas de caja y depósitos cuando las ventas caen",
          "Comparte resultados en el cierre diario"
        ]
      }
    ]
  },
  purchase: {
    overview:
      "Supervisa las órdenes de compra y recepciones para asegurar que el inventario llegue a tiempo y al costo correcto.",
    highlights: [
      "Seguimiento del estatus de cada orden de compra",
      "Control de líneas recibidas vs. ordenadas",
      "Detección de proveedores con retrasos recurrentes"
    ],
    sections: [
      {
        title: "Indicadores clave",
        description: "Evalúa el flujo de mercancía desde la orden hasta la recepción.",
        bullets: ["Órdenes abiertas vs. cerradas", "Valor recibido vs. planificado", "Tiempo promedio de recepción"]
      },
      {
        title: "Acciones operativas",
        description: "Facilita el seguimiento del equipo de compras.",
        bullets: [
          "Contacta proveedores con entregas vencidas",
          "Registra incidencias de costos fuera de contrato",
          "Coordina inspección de calidad al recibir"
        ]
      },
      {
        title: "Reportes complementarios",
        description: "Cruza información con inventario para validar disponibilidad.",
        bullets: ["Inventario en mano", "Rotación por categoría", "Notas de recepción"]
      }
    ]
  },
  "inventory-report": {
    overview:
      "Analiza existencias, antigüedad y ajustes para saber qué productos requieren promoción, remate o reparación.",
    highlights: [
      "Saldo actual por código y categoría",
      "Clasificación por antigüedad para evitar mercancía obsoleta",
      "Visibilidad de productos dañados o en cuarentena"
    ],
    sections: [
      {
        title: "Preguntas frecuentes",
        description: "Apóyate en este reporte para decidir transferencias o descuentos.",
        bullets: [
          "¿Qué artículos superan los 90 días en vitrina?",
          "¿Qué códigos necesitan reabastecimiento inmediato?",
          "¿Cuánto capital está inmovilizado en artículos dañados?"
        ]
      },
      {
        title: "Próximos pasos",
        description: "Coordina acciones con inventario y ventas.",
        bullets: [
          "Agenda conteos cíclicos para familias críticas",
          "Define promociones para rotar inventario envejecido",
          "Escala ajustes de costo a contabilidad"
        ]
      }
    ]
  },
  marketing: {
    overview:
      "Evalúa el desempeño de campañas y segmentos para invertir en los mensajes que generan visitas y redenciones.",
    highlights: [
      "Volumen de envíos y entregas",
      "Tasas de apertura, clic y redención",
      "Impacto por canal: SMS, WhatsApp o email"
    ],
    sections: [
      {
        title: "Segmentación",
        description: "Verifica que los públicos sean lo suficientemente precisos.",
        bullets: [
          "Filtra campañas por canal y sucursal",
          "Identifica segmentos con baja interacción",
          "Cruza resultados con compras o layaways"
        ]
      },
      {
        title: "Iteración",
        description: "Planea mejoras para los próximos envíos.",
        bullets: [
          "Actualiza creativos según campañas top",
          "Ajusta la frecuencia de envíos",
          "Documenta aprendizajes en la bitácora de marketing"
        ]
      }
    ]
  },
  "customer-report": {
    overview:
      "Comprende el crecimiento de la base de clientes y su valor de vida para diseñar programas de fidelidad y retención.",
    highlights: [
      "Nuevos vs. recurrentes por periodo",
      "Valor de vida promedio por segmento",
      "Estado de consentimiento para marketing"
    ],
    sections: [
      {
        title: "Oportunidades",
        description: "Detecta clientes con riesgo de abandono o alto potencial.",
        bullets: [
          "Clientes VIP sin compras recientes",
          "Clientes frecuentes con tickets decrecientes",
          "Clientes sin consentimiento de marketing"
        ]
      },
      {
        title: "Seguimiento",
        description: "Define acciones directas desde CRM.",
        bullets: [
          "Agenda campañas de retención",
          "Ofrece beneficios a clientes leales",
          "Solicita actualización de datos de contacto"
        ]
      }
    ]
  },
  expense: {
    overview:
      "Controla el gasto operativo y detecta desviaciones contra presupuesto por categoría o sucursal.",
    highlights: [
      "Monto total gastado vs. planificado",
      "Categorías con mayor participación",
      "Sucursales con variaciones negativas"
    ],
    sections: [
      {
        title: "Revisión financiera",
        description: "Asegura que cada gasto tenga soporte y autorización.",
        bullets: [
          "Cruza con vouchers o facturas",
          "Valida límites de pago por rol",
          "Identifica gastos repetitivos no planificados"
        ]
      },
      {
        title: "Medidas correctivas",
        description: "Comparte hallazgos con contabilidad y operaciones.",
        bullets: [
          "Ajusta presupuestos trimestrales",
          "Negocia con proveedores de alto costo",
          "Clasifica correctamente gastos extraordinarios"
        ]
      }
    ]
  },
  income: {
    overview:
      "Resume ingresos fuera de las ventas regulares para entender aportes de servicios, intereses y otros conceptos.",
    highlights: [
      "Ingresos recurrentes vs. extraordinarios",
      "Tendencia de ingresos financieros",
      "Notas o comentarios sobre cobros especiales"
    ],
    sections: [
      {
        title: "Conciliación",
        description: "Alinea los registros con contabilidad.",
        bullets: [
          "Valida depósitos bancarios contra ingresos registrados",
          "Confirma clasificación correcta de cuentas",
          "Documenta ingresos diferidos"
        ]
      },
      {
        title: "Decisiones",
        description: "Evalúa si los ingresos cumplen expectativas.",
        bullets: [
          "Proyecta ingresos por intereses de préstamos",
          "Analiza servicios adicionales más rentables",
          "Revisa políticas de cobro"
        ]
      }
    ]
  },
  "pawns-lifecycle": {
    overview:
      "Sigue el ciclo de vida de los empeños para anticipar necesidades de capital y acciones de cobranza.",
    highlights: [
      "Tickets creados, redimidos y perdidos",
      "Principal pendiente por estado",
      "Fechas clave del ciclo de empeño"
    ],
    sections: [
      {
        title: "Gestión de cartera",
        description: "Prioriza el seguimiento comercial según el estado del empeño.",
        bullets: [
          "Contacta a clientes próximos a vencer",
          "Programa subastas para empeños perdidos",
          "Calcula capital disponible para nuevos préstamos"
        ]
      },
      {
        title: "Indicadores de servicio",
        description: "Mide la efectividad del proceso de recuperación.",
        bullets: [
          "Porcentaje de redención",
          "Tiempo promedio en empeño",
          "Motivos de pérdida registrados"
        ]
      }
    ]
  },
  "loan-book": {
    overview:
      "Obtén una fotografía del portafolio de préstamos para evaluar riesgo, rendimiento y composición.",
    highlights: [
      "Saldo de principal e interés acumulado",
      "Préstamos activos por nivel de riesgo",
      "Próximos vencimientos por sucursal"
    ],
    sections: [
      {
        title: "Riesgo",
        description: "Identifica clientes que requieren atención inmediata.",
        bullets: [
          "Préstamos con atraso mayor a 30 días",
          "Clientes con historial de refinanciamientos",
          "Sucursales con mayor morosidad"
        ]
      },
      {
        title: "Estrategia",
        description: "Usa la información para ajustar políticas de crédito.",
        bullets: [
          "Revisa tasas de interés por código",
          "Evalúa límites de préstamo por segmento",
          "Define campañas de renovación"
        ]
      }
    ]
  },
  "expire-loans": {
    overview:
      "Detecta préstamos por vencer para activar recordatorios, renegociaciones o procesos de cobranza temprana.",
    highlights: [
      "Volumen de préstamos a vencer vs. vencidos",
      "Balances en riesgo de incobrabilidad",
      "Estado de contacto con el cliente"
    ],
    sections: [
      {
        title: "Priorización",
        description: "Segmenta la cartera para campañas preventivas.",
        bullets: [
          "Préstamos con vencimiento en los próximos 7 días",
          "Clientes ya contactados vs. pendientes",
          "Montos con mayor impacto en flujo de caja"
        ]
      },
      {
        title: "Seguimiento",
        description: "Documenta acciones y resultados.",
        bullets: [
          "Registra llamadas y mensajes enviados",
          "Escala casos de alto riesgo a gerencia",
          "Coordina ofertas de extensión o refinanciamiento"
        ]
      }
    ]
  },
  "voids-refund-ratio": {
    overview:
      "Controla anulaciones y reembolsos para detectar errores operativos o posibles fraudes por colaborador.",
    highlights: [
      "Voids y refunds por colaborador y rol",
      "Ratio respecto a transacciones atendidas",
      "Notas y motivos capturados en cada caso"
    ],
    sections: [
      {
        title: "Gobernanza",
        description: "Asegura que los procesos de autorización se cumplan.",
        bullets: [
          "Valida firmas o PIN de aprobación",
          "Verifica documentación de soporte",
          "Audita los reembolsos en efectivo"
        ]
      },
      {
        title: "Capacitación",
        description: "Mitiga reincidencias con entrenamiento específico.",
        bullets: [
          "Refuerza políticas de devolución",
          "Monitorea nuevas contrataciones durante el onboarding",
          "Reconoce al personal con ratios saludables"
        ]
      }
    ]
  }
};

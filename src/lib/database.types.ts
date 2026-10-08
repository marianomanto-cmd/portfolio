// Generado desde el schema de Supabase (proyecto Portfolio). No editar a mano:
// se regenera después de cada migración.
//
// Los numeric figuran como `number` a propósito: PostgREST los manda como
// número JSON. El código lee montos con `::text` y el parser de plata sólo
// acepta strings, así que un cast olvidado es un error de tipos (D-32).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activos: {
        Row: {
          activo_bool: boolean
          color: string | null
          fecha_vencimiento: string | null
          geografia: string
          id: number
          indexacion: string | null
          mercado: string | null
          moneda_riesgo: string
          nombre: string
          ticker: string
          ticker_subyacente: string | null
          tipo: string
        }
        Insert: {
          activo_bool?: boolean
          color?: string | null
          fecha_vencimiento?: string | null
          geografia: string
          id?: never
          indexacion?: string | null
          mercado?: string | null
          moneda_riesgo: string
          nombre: string
          ticker: string
          ticker_subyacente?: string | null
          tipo: string
        }
        Update: {
          activo_bool?: boolean
          color?: string | null
          fecha_vencimiento?: string | null
          geografia?: string
          id?: never
          indexacion?: string | null
          mercado?: string | null
          moneda_riesgo?: string
          nombre?: string
          ticker?: string
          ticker_subyacente?: string | null
          tipo?: string
        }
        Relationships: []
      }
      auditoria: {
        Row: {
          antes: Json | null
          carga_id: number | null
          despues: Json | null
          en: string
          id: number
          operacion: string
          tabla: string
        }
        Insert: {
          antes?: Json | null
          carga_id?: number | null
          despues?: Json | null
          en?: string
          id?: never
          operacion: string
          tabla: string
        }
        Update: {
          antes?: Json | null
          carga_id?: number | null
          despues?: Json | null
          en?: string
          id?: never
          operacion?: string
          tabla?: string
        }
        Relationships: []
      }
      bienes: {
        Row: {
          activo_bool: boolean
          geografia: string
          id: number
          moneda_valuacion: string
          nombre: string
          pasivo_id: number | null
          tipo: string
        }
        Insert: {
          activo_bool?: boolean
          geografia?: string
          id?: never
          moneda_valuacion: string
          nombre: string
          pasivo_id?: number | null
          tipo: string
        }
        Update: {
          activo_bool?: boolean
          geografia?: string
          id?: never
          moneda_valuacion?: string
          nombre?: string
          pasivo_id?: number | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "bienes_pasivo_id_fkey"
            columns: ["pasivo_id"]
            isOneToOne: true
            referencedRelation: "pasivos"
            referencedColumns: ["id"]
          },
        ]
      }
      bienes_valuaciones: {
        Row: {
          bien_id: number
          carga_id: number
          fecha: string
          fuente: string
          valor: number
        }
        Insert: {
          bien_id: number
          carga_id: number
          fecha: string
          fuente: string
          valor: number
        }
        Update: {
          bien_id?: number
          carga_id?: number
          fecha?: string
          fuente?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "bienes_valuaciones_bien_id_fkey"
            columns: ["bien_id"]
            isOneToOne: false
            referencedRelation: "bienes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bienes_valuaciones_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "cargas"
            referencedColumns: ["id"]
          },
        ]
      }
      cargas: {
        Row: {
          archivo_path: string | null
          archivo_sha256: string | null
          confirm_token: string | null
          creado_en: string
          cuenta_id: number | null
          estado: string
          fecha: string
          grabado: Json | null
          id: number
          lector: string | null
          lectura_cruda: Json | null
          listado_completo: boolean
          lote: string | null
          motivo_reversion: string | null
          origen: string
          reemplaza_a: number | null
          revertida_en: string | null
          tiempo_activo_ms: number | null
        }
        Insert: {
          archivo_path?: string | null
          archivo_sha256?: string | null
          confirm_token?: string | null
          creado_en?: string
          cuenta_id?: number | null
          estado?: string
          fecha: string
          grabado?: Json | null
          id?: never
          lector?: string | null
          lectura_cruda?: Json | null
          listado_completo?: boolean
          lote?: string | null
          motivo_reversion?: string | null
          origen: string
          reemplaza_a?: number | null
          revertida_en?: string | null
          tiempo_activo_ms?: number | null
        }
        Update: {
          archivo_path?: string | null
          archivo_sha256?: string | null
          confirm_token?: string | null
          creado_en?: string
          cuenta_id?: number | null
          estado?: string
          fecha?: string
          grabado?: Json | null
          id?: never
          lector?: string | null
          lectura_cruda?: Json | null
          listado_completo?: boolean
          lote?: string | null
          motivo_reversion?: string | null
          origen?: string
          reemplaza_a?: number | null
          revertida_en?: string | null
          tiempo_activo_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cargas_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargas_reemplaza_a_fkey"
            columns: ["reemplaza_a"]
            isOneToOne: false
            referencedRelation: "cargas"
            referencedColumns: ["id"]
          },
        ]
      }
      condiciones_bono: {
        Row: {
          activo_id: number
          cer_base: number | null
          detalle: Json | null
          fecha_emision: string | null
          lag_dias_habiles: number
          regla_dual: string | null
          tamar_spread: number | null
          tasa_real: number | null
        }
        Insert: {
          activo_id: number
          cer_base?: number | null
          detalle?: Json | null
          fecha_emision?: string | null
          lag_dias_habiles?: number
          regla_dual?: string | null
          tamar_spread?: number | null
          tasa_real?: number | null
        }
        Update: {
          activo_id?: number
          cer_base?: number | null
          detalle?: Json | null
          fecha_emision?: string | null
          lag_dias_habiles?: number
          regla_dual?: string | null
          tamar_spread?: number | null
          tasa_real?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "condiciones_bono_activo_id_fkey"
            columns: ["activo_id"]
            isOneToOne: true
            referencedRelation: "activos"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizaciones: {
        Row: {
          activo_id: number
          carga_id: number
          fecha: string
          precio_pesos: number
          precio_usd_subyacente: number | null
        }
        Insert: {
          activo_id: number
          carga_id: number
          fecha: string
          precio_pesos: number
          precio_usd_subyacente?: number | null
        }
        Update: {
          activo_id?: number
          carga_id?: number
          fecha?: string
          precio_pesos?: number
          precio_usd_subyacente?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cotizaciones_activo_id_fkey"
            columns: ["activo_id"]
            isOneToOne: false
            referencedRelation: "activos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "cargas"
            referencedColumns: ["id"]
          },
        ]
      }
      cuentas: {
        Row: {
          activa: boolean
          formato_carga: string
          id: number
          nombre: string
          tipo: string
        }
        Insert: {
          activa?: boolean
          formato_carga: string
          id?: never
          nombre: string
          tipo: string
        }
        Update: {
          activa?: boolean
          formato_carga?: string
          id?: never
          nombre?: string
          tipo?: string
        }
        Relationships: []
      }
      escenarios: {
        Row: {
          actualizado_en: string
          creado_en: string
          id: number
          nombre: string
          notas: string | null
          supuestos: Json
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          id?: never
          nombre: string
          notas?: string | null
          supuestos: Json
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          id?: never
          nombre?: string
          notas?: string | null
          supuestos?: Json
        }
        Relationships: []
      }
      eventos: {
        Row: {
          activo_id: number | null
          carga_id: number | null
          fecha: string
          id: number
          tipo: string
          titulo: string
        }
        Insert: {
          activo_id?: number | null
          carga_id?: number | null
          fecha: string
          id?: never
          tipo: string
          titulo: string
        }
        Update: {
          activo_id?: number | null
          carga_id?: number | null
          fecha?: string
          id?: never
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_activo_id_fkey"
            columns: ["activo_id"]
            isOneToOne: false
            referencedRelation: "activos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "cargas"
            referencedColumns: ["id"]
          },
        ]
      }
      feriados: {
        Row: {
          descripcion: string
          fecha: string
          mercado: string
        }
        Insert: {
          descripcion: string
          fecha: string
          mercado: string
        }
        Update: {
          descripcion?: string
          fecha?: string
          mercado?: string
        }
        Relationships: []
      }
      flujo_mensual: {
        Row: {
          cripto_venta_usado: number | null
          gastos_fijos_reales: number | null
          gastos_variables: number | null
          ingreso_pesos: number | null
          ingreso_usd: number | null
          mes: string
          notas: string | null
        }
        Insert: {
          cripto_venta_usado?: number | null
          gastos_fijos_reales?: number | null
          gastos_variables?: number | null
          ingreso_pesos?: number | null
          ingreso_usd?: number | null
          mes: string
          notas?: string | null
        }
        Update: {
          cripto_venta_usado?: number | null
          gastos_fijos_reales?: number | null
          gastos_variables?: number | null
          ingreso_pesos?: number | null
          ingreso_usd?: number | null
          mes?: string
          notas?: string | null
        }
        Relationships: []
      }
      flujos_bono: {
        Row: {
          activo_id: number
          amortizacion: number
          fecha: string
          interes: number | null
        }
        Insert: {
          activo_id: number
          amortizacion?: number
          fecha: string
          interes?: number | null
        }
        Update: {
          activo_id?: number
          amortizacion?: number
          fecha?: string
          interes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "flujos_bono_activo_id_fkey"
            columns: ["activo_id"]
            isOneToOne: false
            referencedRelation: "activos"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos_fijos: {
        Row: {
          categoria: string
          concepto: string
          id: number
          moneda: string
          monto: number
          vigente_desde: string
          vigente_hasta: string | null
        }
        Insert: {
          categoria: string
          concepto: string
          id?: never
          moneda?: string
          monto: number
          vigente_desde: string
          vigente_hasta?: string | null
        }
        Update: {
          categoria?: string
          concepto?: string
          id?: never
          moneda?: string
          monto?: number
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Relationships: []
      }
      indices: {
        Row: {
          carga_id: number
          fecha: string
          indice: string
          valor: number
        }
        Insert: {
          carga_id: number
          fecha: string
          indice: string
          valor: number
        }
        Update: {
          carga_id?: number
          fecha?: string
          indice?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "indices_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "cargas"
            referencedColumns: ["id"]
          },
        ]
      }
      ingresos_fijos: {
        Row: {
          concepto: string
          id: number
          moneda: string
          monto: number
          vigente_desde: string
          vigente_hasta: string | null
        }
        Insert: {
          concepto: string
          id?: never
          moneda: string
          monto: number
          vigente_desde: string
          vigente_hasta?: string | null
        }
        Update: {
          concepto?: string
          id?: never
          moneda?: string
          monto?: number
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Relationships: []
      }
      movimientos_capital: {
        Row: {
          carga_id: number
          cuenta_destino_id: number | null
          cuenta_origen_id: number | null
          fecha: string
          fecha_acreditacion: string | null
          id: number
          impuesto: number
          moneda_destino: string | null
          moneda_origen: string | null
          monto_destino: number | null
          monto_origen: number | null
          notas: string | null
          tc_aplicado: number | null
          tipo: string
        }
        Insert: {
          carga_id: number
          cuenta_destino_id?: number | null
          cuenta_origen_id?: number | null
          fecha: string
          fecha_acreditacion?: string | null
          id?: never
          impuesto?: number
          moneda_destino?: string | null
          moneda_origen?: string | null
          monto_destino?: number | null
          monto_origen?: number | null
          notas?: string | null
          tc_aplicado?: number | null
          tipo: string
        }
        Update: {
          carga_id?: number
          cuenta_destino_id?: number | null
          cuenta_origen_id?: number | null
          fecha?: string
          fecha_acreditacion?: string | null
          id?: never
          impuesto?: number
          moneda_destino?: string | null
          moneda_origen?: string | null
          monto_destino?: number | null
          monto_origen?: number | null
          notas?: string | null
          tc_aplicado?: number | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_capital_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "cargas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_capital_cuenta_destino_id_fkey"
            columns: ["cuenta_destino_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_capital_cuenta_origen_id_fkey"
            columns: ["cuenta_origen_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
        ]
      }
      nivel_operaciones: {
        Row: {
          cantidad: number
          nivel_id: number
          operacion_id: number
        }
        Insert: {
          cantidad: number
          nivel_id: number
          operacion_id: number
        }
        Update: {
          cantidad?: number
          nivel_id?: number
          operacion_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "nivel_operaciones_nivel_id_fkey"
            columns: ["nivel_id"]
            isOneToOne: false
            referencedRelation: "niveles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nivel_operaciones_operacion_id_fkey"
            columns: ["operacion_id"]
            isOneToOne: false
            referencedRelation: "operaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      niveles: {
        Row: {
          activo_id: number
          creado_en: string
          estado: string
          fecha_definicion: string
          id: number
          nivel_entrada_decidido: number
          nivel_invalidacion: number | null
          referencia: string
          tesis_texto: string
          tramo: number
        }
        Insert: {
          activo_id: number
          creado_en?: string
          estado?: string
          fecha_definicion: string
          id?: never
          nivel_entrada_decidido: number
          nivel_invalidacion?: number | null
          referencia?: string
          tesis_texto: string
          tramo?: number
        }
        Update: {
          activo_id?: number
          creado_en?: string
          estado?: string
          fecha_definicion?: string
          id?: never
          nivel_entrada_decidido?: number
          nivel_invalidacion?: number | null
          referencia?: string
          tesis_texto?: string
          tramo?: number
        }
        Relationships: [
          {
            foreignKeyName: "niveles_activo_id_fkey"
            columns: ["activo_id"]
            isOneToOne: false
            referencedRelation: "activos"
            referencedColumns: ["id"]
          },
        ]
      }
      operaciones: {
        Row: {
          activo_id: number
          cantidad: number
          carga_id: number
          ccl_del_dia: number | null
          comisiones: number
          creado_en: string
          cuenta_id: number
          fecha: string
          fecha_origen: string | null
          id: number
          importe: number | null
          moneda: string
          notas: string | null
          precio: number | null
          precio_carga_id: number | null
          tipo: string
        }
        Insert: {
          activo_id: number
          cantidad: number
          carga_id: number
          ccl_del_dia?: number | null
          comisiones?: number
          creado_en?: string
          cuenta_id: number
          fecha: string
          fecha_origen?: string | null
          id?: never
          importe?: number | null
          moneda?: string
          notas?: string | null
          precio?: number | null
          precio_carga_id?: number | null
          tipo: string
        }
        Update: {
          activo_id?: number
          cantidad?: number
          carga_id?: number
          ccl_del_dia?: number | null
          comisiones?: number
          creado_en?: string
          cuenta_id?: number
          fecha?: string
          fecha_origen?: string | null
          id?: never
          importe?: number | null
          moneda?: string
          notas?: string | null
          precio?: number | null
          precio_carga_id?: number | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "operaciones_activo_id_fkey"
            columns: ["activo_id"]
            isOneToOne: false
            referencedRelation: "activos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operaciones_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "cargas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operaciones_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operaciones_precio_carga_id_fkey"
            columns: ["precio_carga_id"]
            isOneToOne: false
            referencedRelation: "cargas"
            referencedColumns: ["id"]
          },
        ]
      }
      pasivo_cuotas: {
        Row: {
          base_ganancias: number | null
          canon_neto: number
          carga_id: number
          ccl_del_dia_pago: number | null
          cuenta_pago_id: number | null
          fecha_pago: string | null
          fecha_vencimiento: string
          iva_canon: number
          monto_pagado: number | null
          nro: number
          otros_conceptos: number
          pasivo_id: number
          seguro: number
          total_pesos: number | null
        }
        Insert: {
          base_ganancias?: number | null
          canon_neto: number
          carga_id: number
          ccl_del_dia_pago?: number | null
          cuenta_pago_id?: number | null
          fecha_pago?: string | null
          fecha_vencimiento: string
          iva_canon?: number
          monto_pagado?: number | null
          nro: number
          otros_conceptos?: number
          pasivo_id: number
          seguro?: number
          total_pesos?: number | null
        }
        Update: {
          base_ganancias?: number | null
          canon_neto?: number
          carga_id?: number
          ccl_del_dia_pago?: number | null
          cuenta_pago_id?: number | null
          fecha_pago?: string | null
          fecha_vencimiento?: string
          iva_canon?: number
          monto_pagado?: number | null
          nro?: number
          otros_conceptos?: number
          pasivo_id?: number
          seguro?: number
          total_pesos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pasivo_cuotas_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "cargas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pasivo_cuotas_cuenta_pago_id_fkey"
            columns: ["cuenta_pago_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pasivo_cuotas_pasivo_id_fkey"
            columns: ["pasivo_id"]
            isOneToOne: false
            referencedRelation: "pasivos"
            referencedColumns: ["id"]
          },
        ]
      }
      pasivo_saldos: {
        Row: {
          capital_pendiente: number
          carga_id: number
          fecha: string
          pasivo_id: number
        }
        Insert: {
          capital_pendiente: number
          carga_id: number
          fecha: string
          pasivo_id: number
        }
        Update: {
          capital_pendiente?: number
          carga_id?: number
          fecha?: string
          pasivo_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "pasivo_saldos_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "cargas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pasivo_saldos_pasivo_id_fkey"
            columns: ["pasivo_id"]
            isOneToOne: false
            referencedRelation: "pasivos"
            referencedColumns: ["id"]
          },
        ]
      }
      pasivos: {
        Row: {
          alicuota_ganancias: number | null
          anticipo_neto: number | null
          cuotas_totales: number
          fecha_inicio: string
          id: number
          moneda: string
          monto_financiado_neto: number | null
          nombre: string
          notas: string | null
          opcion_compra_fecha: string | null
          opcion_compra_neto: number | null
          tipo: string
          valor_bien: number | null
        }
        Insert: {
          alicuota_ganancias?: number | null
          anticipo_neto?: number | null
          cuotas_totales: number
          fecha_inicio: string
          id?: never
          moneda: string
          monto_financiado_neto?: number | null
          nombre: string
          notas?: string | null
          opcion_compra_fecha?: string | null
          opcion_compra_neto?: number | null
          tipo: string
          valor_bien?: number | null
        }
        Update: {
          alicuota_ganancias?: number | null
          anticipo_neto?: number | null
          cuotas_totales?: number
          fecha_inicio?: string
          id?: never
          moneda?: string
          monto_financiado_neto?: number | null
          nombre?: string
          notas?: string | null
          opcion_compra_fecha?: string | null
          opcion_compra_neto?: number | null
          tipo?: string
          valor_bien?: number | null
        }
        Relationships: []
      }
      ratios_cedear: {
        Row: {
          activo_id: number
          ratio: number
          vigente_desde: string
        }
        Insert: {
          activo_id: number
          ratio: number
          vigente_desde: string
        }
        Update: {
          activo_id?: number
          ratio?: number
          vigente_desde?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratios_cedear_activo_id_fkey"
            columns: ["activo_id"]
            isOneToOne: false
            referencedRelation: "activos"
            referencedColumns: ["id"]
          },
        ]
      }
      saldos_liquidez: {
        Row: {
          carga_id: number
          cuenta_id: number
          fecha: string
          moneda: string
          monto: number
        }
        Insert: {
          carga_id: number
          cuenta_id: number
          fecha: string
          moneda: string
          monto: number
        }
        Update: {
          carga_id?: number
          cuenta_id?: number
          fecha?: string
          moneda?: string
          monto?: number
        }
        Relationships: [
          {
            foreignKeyName: "saldos_liquidez_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "cargas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saldos_liquidez_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
        ]
      }
      tipo_cambio: {
        Row: {
          carga_id: number
          ccl: number | null
          cripto_venta: number | null
          fecha: string
          mep: number | null
          oficial: number | null
          referencia: string | null
        }
        Insert: {
          carga_id: number
          ccl?: number | null
          cripto_venta?: number | null
          fecha: string
          mep?: number | null
          oficial?: number | null
          referencia?: string | null
        }
        Update: {
          carga_id?: number
          ccl?: number | null
          cripto_venta?: number | null
          fecha?: string
          mep?: number | null
          oficial?: number | null
          referencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tipo_cambio_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "cargas"
            referencedColumns: ["id"]
          },
        ]
      }
      vencimientos: {
        Row: {
          activo_id: number
          destino_decidido: string | null
          fecha: string
          notas: string | null
        }
        Insert: {
          activo_id: number
          destino_decidido?: string | null
          fecha: string
          notas?: string | null
        }
        Update: {
          activo_id?: number
          destino_decidido?: string | null
          fecha?: string
          notas?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vencimientos_activo_id_fkey"
            columns: ["activo_id"]
            isOneToOne: false
            referencedRelation: "activos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_tenencias: {
        Row: {
          activo_id: number | null
          cantidad: string | null
          cuenta_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "operaciones_activo_id_fkey"
            columns: ["activo_id"]
            isOneToOne: false
            referencedRelation: "activos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operaciones_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_ultima_cotizacion: {
        Row: {
          activo_id: number | null
          carga_id: number | null
          fecha: string | null
          precio_pesos: string | null
          precio_usd_subyacente: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cotizaciones_activo_id_fkey"
            columns: ["activo_id"]
            isOneToOne: false
            referencedRelation: "activos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "cargas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_ultimo_saldo: {
        Row: {
          carga_id: number | null
          cuenta_id: number | null
          fecha: string | null
          moneda: string | null
          monto: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saldos_liquidez_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "cargas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saldos_liquidez_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      alta_activo: { Args: { p: Json }; Returns: number }
      confirmar_carga: { Args: { p: Json }; Returns: Json }
      editar_activo: { Args: { p: Json; p_id: number }; Returns: undefined }
      guardar_manual: { Args: { p: Json }; Returns: number }
      leer_fecha: { Args: { campo: string; j: Json }; Returns: string }
      leer_id: { Args: { campo: string; j: Json }; Returns: number }
      leer_monto: { Args: { campo: string; j: Json }; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

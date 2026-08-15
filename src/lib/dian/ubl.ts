/**
 * Generación de XML UBL 2.1 (Invoice) y simulación de CUFE — modo DEMO.
 *
 * ADVERTENCIA FISCAL: este es un generador de **demostración**. No existe
 * firma digital XAdES-EPES ni envío real a la DIAN. El CUFE que produce es
 * un SHA-256 local de campos canónicos; **no es válido ante la DIAN** y no
 * debe usarse en producción. El ambiente productivo requiere proveedor
 * tecnológico homologado por la DIAN, certificado de firma digital y
 * validación de revisor fiscal — todo lo cual queda fuera de este módulo.
 *
 * El objetivo del demo es end-to-end el flujo de la aplicación: armar el
 * XML UBL, guardarlo como evento inmutable, mostrar el CUFE y el estado,
 * para que cuando el flujo productivo llegue solo se reemplace esta lib por
 * el cliente del proveedor homologado, sin tocar la UI ni las tablas.
 */

import { createHash } from 'node:crypto'

/** Snapshot de factura para armar el XML. */
export interface InvoiceSnapshot {
  invoiceCode: string
  issuedOn: string // YYYY-MM-DD
  dueOn: string | null
  currency: string // ISO 4217, COP
  clientName: string
  clientTaxId: string // NIT/CC, sin guiones ni DV
  organizationName: string
  organizationTaxId: string // NIT emisor
  organizationAddress: string
  organizationCity: string
  subtotalCents: number
  taxCents: number
  totalCents: number
  items: Array<{
    description: string
    quantity: number
    unitPriceCents: number
    taxRate: number // %
  }>
}

/**
 * Cadena para el CUFE simulado. Campos separados por `&` y ordenados según la
 * convención DIAN (NumFactura, FecFactura, NitObligado, NumAdq, NitAdq, ValFactura,
 * ValTotalPagar...). Aquí se arma una versión canónica simple, **no** la cadena
 * exacta de la DIAN: sin firma ni UUID, sin el valor de IVA desglose completo.
 * Suficiente para que el CUFE sea determinista por factura y recupere el mismo
 * documento para auditoría.
 */
export function buildCufeString(s: InvoiceSnapshot, ambiente: 'demo'): string {
  return [
    s.invoiceCode || 'SIN-CODE',
    s.issuedOn,
    s.organizationTaxId || '0',
    s.clientTaxId || '0',
    (s.totalCents / 100).toFixed(2),
    ambiente,
  ].join('&')
}

/** CUFE simulado. SHA-256 hexadecimal de la cadena canónica. */
export function computeCufe(s: InvoiceSnapshot, ambiente: 'demo'): string {
  return createHash('sha256').update(buildCufeString(s, ambiente), 'utf8').digest('hex')
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Genera un XML UBL 2.1 de `Invoice` simplificado.
 *
 * No incluye todos los campos obligatorios del estándar DIAN (firma,
 * claveTecnica, QR, representación gráfica, DIAN slot). Es un esqueleto
 * para el ambiente demo: valida la estructura mínima (`cbc:ID`,
 * `cbc:IssueDate`, Party, LegalMonetaryTotal, InvoiceLine) y deja huecos
 * marcados con `<!-- demo -->` donde irían los slots productivos. Suficiente
 * para que el flujo kigyo almacene, muestre y recupere el XML sin romperse.
 */
export function buildUblInvoiceXml(s: InvoiceSnapshot, cufe: string): string {
  const items = s.items.map((it, idx) => {
    const lineExt = ((it.quantity * it.unitPriceCents) / 100).toFixed(2)
    const taxAmount = ((it.quantity * it.unitPriceCents * it.taxRate) / 10000).toFixed(2)
    return `    <cac:InvoiceLine>
      <cbc:ID>${idx + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="NIU">${it.quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${escapeXml(s.currency)}">${lineExt}</cbc:LineExtensionAmount>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="${escapeXml(s.currency)}">${taxAmount}</cbc:TaxAmount>
        <cac:TaxSubtotal>
          <cbc:TaxableAmount currencyID="${escapeXml(s.currency)}">${lineExt}</cbc:TaxableAmount>
          <cbc:TaxAmount currencyID="${escapeXml(s.currency)}">${taxAmount}</cbc:TaxAmount>
          <cac:TaxCategory>
            <cbc:Percent>${it.taxRate.toFixed(2)}</cbc:Percent>
            <cac:TaxScheme>
              <cbc:ID>01</cbc:ID>
              <cbc:Name>IVA</cbc:Name>
            </cac:TaxScheme>
          </cac:TaxCategory>
        </cac:TaxSubtotal>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Description>${escapeXml(it.description)}</cbc:Description>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${escapeXml(s.currency)}">${(it.unitPriceCents / 100).toFixed(2)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`
  }).join('\n')

  const taxTotal = (s.taxCents / 100).toFixed(2)
  const lineTotal = (s.subtotalCents / 100).toFixed(2)
  const payable = (s.totalCents / 100).toFixed(2)

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:tc:ebxml-regrep:xsd:rim:3.0"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>10</cbc:CustomizationID>
  <!-- demo: en producción el ProfileID identifica el documento electrónico colombiano -->
  <cbc:ProfileID>DIAN_2.1</cbc:ProfileID>
  <cbc:ID>${escapeXml(s.invoiceCode || 'SIN-CODE')}</cbc:ID>
  <cbc:UUID schemeID="CUFE">${escapeXml(cufe)}</cbc:UUID>
  <cbc:IssueDate>${escapeXml(s.issuedOn)}</cbc:IssueDate>
  ${s.dueOn ? `<cbc:DueDate>${escapeXml(s.dueOn)}</cbc:DueDate>` : '<!-- demo: sin fecha de vencimiento -->'}
  <cbc:DocumentCurrencyCode>${escapeXml(s.currency)}</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="NIT">${escapeXml(s.organizationTaxId || '0')}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${escapeXml(s.organizationName)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:CityName>${escapeXml(s.organizationCity)}</cbc:CityName>
        <cbc:AddressLine>
          <cbc:Line>${escapeXml(s.organizationAddress)}</cbc:Line>
        </cbc:AddressLine>
      </cac:PostalAddress>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="NIT">${escapeXml(s.clientTaxId || '0')}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${escapeXml(s.clientName)}</cbc:Name>
      </cac:PartyName>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${escapeXml(s.currency)}">${taxTotal}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${escapeXml(s.currency)}">${lineTotal}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${escapeXml(s.currency)}">${lineTotal}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${escapeXml(s.currency)}">${payable}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${escapeXml(s.currency)}">${payable}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${items}
  <!-- demo: firma digital XAdES-EPES y slot DIAN pendientes -->
</Invoice>
`
}

/** Respuesta simulada del endpoint DIAN demo. */
export interface DianDemoResponse {
  status: 'aceptada' | 'rechazada' | 'procesando' | 'pendiente'
  message: string
  responseRaw: string
}

/**
 * "Envío" DIAN simulado. Sin red, sin firma, sin proveedor. Resultado
 * determinista: la respuesta depende del CUFE para estabilidad entre
 * re-llamadas (no debería cambiar de estado sin un re-envío explícito).
 *
 * Acepta el 100% de las facturas en demo: el modo existe para ejercer el
 * flujo, no para rechazar. Se restringe cuando falten datos mínimos.
 */
export function dianDemoSend(cufe: string, xml: string): DianDemoResponse {
  // Sin CUFE o sin XML no hay nada que enviar.
  if (!cufe || !xml) {
    return {
      status: 'rechazada',
      message: 'Sin CUFE o XML completo para enviar.',
      responseRaw: JSON.stringify({ error: 'missing_payload' }),
    }
  }

  return {
    status: 'aceptada',
    message: 'Documento aceptado en ambiente demo (no válido ante la DIAN).',
    responseRaw: JSON.stringify({
      IsSuccess: true,
      ErrorMessage: '',
      DocumentNumber: cufe.slice(0, 16),
      EventId: 'demo-' + Date.now(),
      Accepted: true,
    }, null, 2),
  }
}
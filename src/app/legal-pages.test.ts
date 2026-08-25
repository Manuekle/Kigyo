import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REGISTRY } from '@/lib/modules/registry'

/**
 * Los documentos legales tienen que describir el producto que existe.
 *
 * Esta prueba nace de encontrar, en las dos páginas legales publicadas, tres
 * afirmaciones falsas y una ausencia grave:
 *
 *   · «cookies analíticas para entender cómo se usa el Servicio» — no hay
 *     analítica de ningún tipo en el repositorio;
 *   · «respaldos automáticos y monitoreo continuo» — nada en el producto lo
 *     sostenía;
 *   · unos Términos que describían Kigyo como «gestión de personas… nómina,
 *     documentos, vacaciones», sin mencionar el punto de venta, la facturación
 *     ni los módulos clínicos — un contrato que describe mal su objeto;
 *   · y ni una palabra sobre que los datos se alojan fuera del país, ni sobre
 *     que la plataforma guarda historias clínicas.
 *
 * Ninguna se veía en pantalla salvo que alguien abriera `/terms` y `/privacy` y
 * los leyera contra el código. Nadie lo hace.
 *
 * Las reglas de abajo son todas **condicionales**: «si el producto tiene X, el
 * documento tiene que decir Y». Eso es lo que las distingue de un corrector
 * ortográfico — dejan de aplicar solas el día que la función desaparezca, y
 * saltan solas el día que aparezca otra.
 */

const TERMS = readFileSync(resolve(process.cwd(), 'src/app/terms/page.tsx'), 'utf8')
const PRIVACY = readFileSync(resolve(process.cwd(), 'src/app/privacy/page.tsx'), 'utf8')
const PKG = readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')

/**
 * El texto visible: sin comentarios y con los espacios colapsados.
 *
 * Lo segundo no es cosmética. El JSX parte las frases largas por ancho de
 * línea, así que «No constituye facturación\n electrónica válida» lleva un
 * salto y dos docenas de espacios en medio. Sin colapsar, cada aserción tendría
 * que adivinar por dónde cortó el formateador — y la que no lo adivinara
 * fallaría sobre un texto que sí dice lo que debe.
 */
function visible(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/\s+/g, ' ')
}

const termsText = visible(TERMS)
const privacyText = visible(PRIVACY)

function hasModule(key: string): boolean {
  return REGISTRY.some((m) => m.key === key)
}

describe('las páginas legales dicen la verdad sobre el producto', () => {
  it('las dos llevan fecha de última actualización', () => {
    for (const [name, text] of [['términos', termsText], ['privacidad', privacyText]] as const) {
      expect(text, `${name} no lleva fecha de actualización`).toMatch(/Última actualización/)
    }
  })

  /**
   * La analítica es la afirmación más fácil de copiar de una plantilla y la más
   * difícil de desmentir mirando la pantalla.
   */
  it('no anuncia analítica mientras no haya ninguna instalada', () => {
    const tracker = /(@vercel\/analytics|posthog|plausible|mixpanel|@segment|google-analytics|gtag)/i
    if (tracker.test(PKG)) return // hay analítica: la política puede y debe nombrarla

    expect(privacyText, 'la política anuncia cookies analíticas y no hay analítica instalada')
      .not.toMatch(/cookies?\s+anal[íi]ticas?/i)
  })

  /**
   * Datos de salud. La categoría con el régimen más estricto de la Ley 1581, y
   * la que estaba sin mencionar.
   */
  it('advierte sobre datos sensibles mientras exista el módulo clínico', () => {
    if (!hasModule('pacientes')) return

    expect(privacyText, 'la política no menciona los datos sensibles de salud')
      .toMatch(/datos sensibles/i)
    expect(privacyText, 'no dice que los datos sensibles exigen autorización explícita')
      .toMatch(/autorizaci[óo]n expl[íi]cita/i)
    expect(termsText, 'los términos no reparten la responsabilidad sobre datos de terceros')
      .toMatch(/encargado/i)
  })

  /** Alojar fuera del país es una transferencia internacional, y hay que decirlo. */
  it('informa la transferencia internacional de datos', () => {
    expect(privacyText).toMatch(/transferencia internacional/i)
    expect(privacyText, 'no dice dónde se alojan los datos').toMatch(/Estados Unidos/i)
  })

  /** Quién es responsable y quién encargado: la distinción que ordena todo lo demás. */
  it('distingue responsable de encargado', () => {
    expect(privacyText).toMatch(/responsable del tratamiento/i)
    expect(privacyText).toMatch(/encargado/i)
  })

  /**
   * Los Términos describen el objeto del contrato, y el objeto es un ERP con
   * punto de venta — no un gestor de nómina.
   */
  it('describe el producto completo y no solo recursos humanos', () => {
    for (const [key, mention] of [
      ['pos', /punto de venta/i],
      ['facturacion', /facturaci[óo]n/i],
      ['inventario', /inventario/i],
    ] as const) {
      if (!hasModule(key)) continue
      expect(termsText, `los términos no mencionan el módulo ${key}`).toMatch(mention)
    }
  })

  /**
   * Los módulos con alcance limitado, dichos donde obligan.
   *
   * DIAN en modo demostración es el que más importa: un cliente que crea que
   * está facturando electrónicamente y no lo esté tiene un problema con la
   * autoridad tributaria, no con nosotros.
   */
  it('declara el alcance limitado de DIAN mientras siga en modo demostración', () => {
    const dian = readFileSync(resolve(process.cwd(), 'src/server/queries/dian.ts'), 'utf8')
    if (!/modo demo|ambiente es SIEMPRE 'demo'/i.test(dian)) return

    expect(termsText, 'los términos no advierten que DIAN es demostración')
      .toMatch(/demostraci[óo]n/i)
    expect(termsText, 'los términos no dicen que no es válido ante la DIAN')
      .toMatch(/no constituye facturaci[óo]n electr[óo]nica v[áa]lida/i)
  })

  /** La nómina sale con parámetros en cero a propósito. Eso es una advertencia. */
  it('aclara que los parámetros de nómina los pone el cliente', () => {
    if (!hasModule('nomina')) return
    expect(termsText).toMatch(/contador/i)
  })

  /** El muro de pago cambió el trato: el servicio ya no es gratuito. */
  it('no dice que el servicio sea gratuito', () => {
    expect(termsText).not.toMatch(/se presta actualmente sin costo/i)
    expect(termsText, 'los términos no nombran la suscripción').toMatch(/suscripci[óo]n/i)
  })

  /**
   * La prueba gratuita, con su alcance exacto.
   *
   * Son 14 días y solo en Starter mensual. Unos términos que la anuncien sin el
   * «solo» son unos términos que la prometen en los seis productos.
   */
  it('acota la prueba gratuita al plan que de verdad la tiene', () => {
    expect(termsText).toMatch(/catorce \(14\) d[íi]as/i)
    expect(termsText, 'los términos no acotan la prueba a Starter mensual')
      .toMatch(/Starter con facturaci[óo]n mensual/i)
    expect(termsText, 'los términos no niegan la prueba a los demás planes')
      .toMatch(/Ning[úu]n otro plan/i)
  })

  /** Los precios son en dólares desde que cuadraron con Polar. */
  it('advierte que el precio está en dólares', () => {
    expect(termsText).toMatch(/d[óo]lares de los Estados Unidos|USD/)
  })
})

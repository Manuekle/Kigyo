'use client'

import {
  FDI_DECIDUOUS_LOWER_LEFT, FDI_DECIDUOUS_LOWER_RIGHT,
  FDI_DECIDUOUS_UPPER_LEFT, FDI_DECIDUOUS_UPPER_RIGHT,
  FDI_LOWER_LEFT, FDI_LOWER_RIGHT, FDI_UPPER_LEFT, FDI_UPPER_RIGHT,
  TOOTH_CONDITION_TONE, type ToothCondition,
} from '@/lib/domain'
import type { ToothFinding } from '@/server/queries/odontologia'

/**
 * El odontograma.
 *
 * Se dibuja como se dibuja en papel: dos arcos, cada uno partido en los dos
 * cuadrantes, y las piezas ordenadas desde el fondo hacia la línea media. Un
 * odontólogo encuentra la 26 sin leer el número porque está donde siempre
 * estuvo, y esa es la única razón por la que el orden importa — una rejilla
 * ordenada por id numérico sería correcta y también ilegible.
 *
 * El estado se marca con una barra de color bajo el número —- rojo lo que hay
 * que tratar, azul lo ya tratado, gris lo ausente—- y no pintando la casilla
 * entera. En papel la casilla va coloreada; aquí la superficie se queda
 * monocroma como todo el producto y el color viaja en la marca, que es el
 * mismo trato que hace `.badge` con su punto. Ver `TOOTH_CONDITION_TONE`.
 *
 * Los temporales solo aparecen cuando el levantamiento tiene alguno anotado.
 * Mostrar siempre las 52 piezas obliga a un adulto a recorrer veinte casillas
 * que nunca va a tocar; ocultarlas del todo impide atender a un niño. Aparecen
 * cuando hacen falta, que es cuando ya hay un hallazgo en ellas o cuando se
 * pide verlas.
 */

interface OdontogramaProps {
  findings: ToothFinding[]
  /** Null deshabilita el clic: la lectura no es lo mismo que la edición. */
  onPick?: (tooth: number) => void
  /** Fuerza la dentición temporal aunque no haya hallazgos en ella. */
  showDeciduous?: boolean
  selected?: number | null
}

/**
 * Lo que se pinta en una pieza cuando tiene varias caras anotadas.
 *
 * La condición «más grave» gana, con el orden que un odontólogo usaría para
 * decidir qué mirar primero: lo que hay que tratar antes que lo ya tratado, y
 * cualquier cosa antes que «sano». Pintar la última anotada haría que el cuadro
 * cambiara de color según el orden de captura, que no significa nada.
 */
const SEVERITY: ToothCondition[] = [
  'Extracción indicada', 'Fracturado', 'Caries', 'Ausente', 'Ortodoncia',
  'Implante', 'Protesis', 'Corona', 'Endodoncia', 'Obturado', 'Sellante', 'Sano',
]

function dominant(findings: ToothFinding[]): ToothCondition | null {
  let best: ToothCondition | null = null
  let bestRank = SEVERITY.length
  for (const f of findings) {
    const rank = SEVERITY.indexOf(f.condition as ToothCondition)
    if (rank >= 0 && rank < bestRank) {
      bestRank = rank
      best = f.condition as ToothCondition
    }
  }
  return best
}

function Quadrant({
  teeth, byTooth, onPick, selected,
}: {
  teeth: readonly number[]
  byTooth: Map<number, ToothFinding[]>
  onPick?: (tooth: number) => void
  selected?: number | null
}) {
  return (
    <div className="odo-quad">
      {teeth.map((tooth) => {
        const findings = byTooth.get(tooth) ?? []
        const condition = dominant(findings)
        const tone = condition ? TOOTH_CONDITION_TONE[condition] : null
        return (
          <button
            key={tooth}
            type="button"
            className={`odo-tooth${tone ? ` t-${tone}` : ''}${selected === tooth ? ' is-sel' : ''}`}
            disabled={!onPick}
            onClick={() => onPick?.(tooth)}
            // El título lleva el detalle por cara, que es lo que el color no
            // puede decir: «16 — Caries (oclusal), Obturado (mesial)».
            title={
              findings.length === 0
                ? `Pieza ${tooth} · sin anotar`
                : `Pieza ${tooth} — ${findings
                    .map((f) => `${f.condition}${f.surface ? ` (${f.surface.toLowerCase()})` : ''}`)
                    .join(', ')}`
            }
            aria-label={
              findings.length === 0
                ? `Pieza ${tooth}, sin anotar`
                : `Pieza ${tooth}, ${findings.map((f) => f.condition).join(', ')}`
            }
          >
            <span className="odo-num">{tooth}</span>
            {findings.length > 1 && <span className="odo-dots">{findings.length}</span>}
            {tone && <span className="odo-bar" aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )
}

export default function Odontograma({
  findings, onPick, showDeciduous = false, selected = null,
}: OdontogramaProps) {
  const byTooth = new Map<number, ToothFinding[]>()
  for (const f of findings) {
    const list = byTooth.get(f.tooth)
    if (list) list.push(f)
    else byTooth.set(f.tooth, [f])
  }

  // Los temporales están anotados cuando alguna pieza cae en los cuadrantes
  // 5-8, que es lo que decide mostrarlos sin preguntar.
  const hasDeciduous = findings.some((f) => f.tooth >= 51)
  const deciduous = showDeciduous || hasDeciduous

  return (
    <div className="odo">
      <div className="odo-arch">
        <Quadrant teeth={FDI_UPPER_RIGHT} byTooth={byTooth} onPick={onPick} selected={selected} />
        <div className="odo-mid" aria-hidden="true" />
        <Quadrant teeth={FDI_UPPER_LEFT} byTooth={byTooth} onPick={onPick} selected={selected} />
      </div>

      {deciduous && (
        <>
          <div className="odo-arch odo-small">
            <Quadrant teeth={FDI_DECIDUOUS_UPPER_RIGHT} byTooth={byTooth} onPick={onPick} selected={selected} />
            <div className="odo-mid" aria-hidden="true" />
            <Quadrant teeth={FDI_DECIDUOUS_UPPER_LEFT} byTooth={byTooth} onPick={onPick} selected={selected} />
          </div>
          <div className="odo-arch odo-small">
            <Quadrant teeth={FDI_DECIDUOUS_LOWER_RIGHT} byTooth={byTooth} onPick={onPick} selected={selected} />
            <div className="odo-mid" aria-hidden="true" />
            <Quadrant teeth={FDI_DECIDUOUS_LOWER_LEFT} byTooth={byTooth} onPick={onPick} selected={selected} />
          </div>
        </>
      )}

      <div className="odo-arch">
        <Quadrant teeth={FDI_LOWER_RIGHT} byTooth={byTooth} onPick={onPick} selected={selected} />
        <div className="odo-mid" aria-hidden="true" />
        <Quadrant teeth={FDI_LOWER_LEFT} byTooth={byTooth} onPick={onPick} selected={selected} />
      </div>
    </div>
  )
}

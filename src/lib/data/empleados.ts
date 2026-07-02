import type { Empleado } from '../types'

export const EMPLEADOS: Empleado[] = [
  { id: 1, name: 'Valentina Torres', role: 'Directora de Recursos Humanos', dept: 'Recursos Humanos', loc: 'Bogotá', st: 'Activo', perm: 'Administrador' },
  { id: 2, name: 'Andrés Morales', role: 'Director de Ingeniería', dept: 'Ingeniería', loc: 'Medellín', st: 'Activo', perm: 'Líder de equipo', manager: 'Valentina Torres' },
  { id: 3, name: 'Camila Restrepo', role: 'Analista Financiera', dept: 'Finanzas', loc: 'Bogotá', st: 'Activo', perm: 'Empleado', manager: 'Valentina Torres' },
  { id: 4, name: 'Diego Vargas', role: 'Ingeniero Solar Senior', dept: 'Ingeniería', loc: 'Remoto', st: 'Activo', perm: 'Empleado', manager: 'Andrés Morales' },
  { id: 5, name: 'Lucía Gómez', role: 'Diseñadora de Sistemas', dept: 'Proyectos', loc: 'Cali', st: 'Activo', perm: 'Empleado', manager: 'Andrés Morales' },
  { id: 6, name: 'Felipe Rodríguez', role: 'Ejecutivo Comercial', dept: 'Comercial', loc: 'Bogotá', st: 'Activo', perm: 'Empleado', manager: 'Valentina Torres' },
  { id: 7, name: 'Sara Jiménez', role: 'Coordinadora Jurídica', dept: 'Legal', loc: 'Bogotá', st: 'Activo', perm: 'Empleado', manager: 'Valentina Torres' },
  { id: 8, name: 'Mateo Herrera', role: 'Supervisor de Obras', dept: 'Obras', loc: 'Medellín', st: 'Inactivo', perm: 'Empleado', manager: 'Valentina Torres' },
]

export const SKILLS_LIST = ['Liderazgo', 'Comunicación', 'Excel', 'SQL', 'Python', 'Diseño', 'Ventas', 'Análisis']

export const SKILL_LEVELS: Record<string, Record<string, number>> = {
  'Valentina Torres': { Liderazgo: 5, Comunicación: 5, Excel: 4, SQL: 2, Python: 1, Diseño: 2, Ventas: 3, Análisis: 4 },
  'Andrés Morales':   { Liderazgo: 4, Comunicación: 4, Excel: 3, SQL: 5, Python: 5, Diseño: 2, Ventas: 2, Análisis: 4 },
  'Camila Restrepo':  { Liderazgo: 2, Comunicación: 3, Excel: 5, SQL: 4, Python: 2, Diseño: 1, Ventas: 2, Análisis: 5 },
  'Diego Vargas':     { Liderazgo: 3, Comunicación: 3, Excel: 3, SQL: 5, Python: 5, Diseño: 3, Ventas: 1, Análisis: 4 },
  'Lucía Gómez':      { Liderazgo: 2, Comunicación: 4, Excel: 2, SQL: 1, Python: 1, Diseño: 5, Ventas: 3, Análisis: 3 },
  'Felipe Rodríguez': { Liderazgo: 3, Comunicación: 5, Excel: 3, SQL: 1, Python: 1, Diseño: 2, Ventas: 5, Análisis: 3 },
  'Sara Jiménez':     { Liderazgo: 2, Comunicación: 4, Excel: 4, SQL: 2, Python: 1, Diseño: 1, Ventas: 2, Análisis: 3 },
  'Mateo Herrera':    { Liderazgo: 2, Comunicación: 3, Excel: 3, SQL: 3, Python: 2, Diseño: 1, Ventas: 1, Análisis: 4 },
}

export const SUCESIONES = [
  { rol: 'Directora de Recursos Humanos', titular: 'Valentina Torres', critico: true,
    ready: [{ name: 'Andrés Morales', score: 78 }, { name: 'Camila Restrepo', score: 64 }] },
  { rol: 'Director de Ingeniería', titular: 'Andrés Morales', critico: true,
    ready: [{ name: 'Diego Vargas', score: 85 }] },
  { rol: 'Ejecutivo Comercial', titular: 'Felipe Rodríguez', critico: false,
    ready: [{ name: 'Mateo Herrera', score: 52 }] },
  { rol: 'Coordinadora Jurídica', titular: 'Sara Jiménez', critico: true,
    ready: [] },
]

export const ROTATION_RISK = [
  { name: 'Mateo Herrera', riesgo: 82, factores: ['Bajo salario', 'Sin ascenso', 'Inactivo'] },
  { name: 'Diego Vargas', riesgo: 61, factores: ['Remoto', 'Carga alta'] },
  { name: 'Lucía Gómez', riesgo: 44, factores: ['Sin plan carrera'] },
  { name: 'Felipe Rodríguez', riesgo: 38, factores: ['Objetivos no cumplidos'] },
  { name: 'Sara Jiménez', riesgo: 29, factores: ['Nuevas responsabilidades'] },
  { name: 'Camila Restrepo', riesgo: 22, factores: [] },
  { name: 'Andrés Morales', riesgo: 15, factores: [] },
  { name: 'Valentina Torres', riesgo: 8, factores: [] },
]

export const EMP_JOURNEY: Record<string, { date: string; ev: string; tag: string; tone: string }[]> = {
  'Valentina Torres': [
    { date: 'Ene 2019', ev: 'Ingreso como Analista RR.HH.', tag: 'Ingreso', tone: 'grn' },
    { date: 'Mar 2020', ev: 'Ascenso a Coordinadora', tag: 'Ascenso', tone: 'blu' },
    { date: 'Jul 2022', ev: 'Directora de RR.HH.', tag: 'Ascenso', tone: 'vio' },
  ],
  'Andrés Morales': [
    { date: 'Feb 2020', ev: 'Ingreso como Desarrollador', tag: 'Ingreso', tone: 'grn' },
    { date: 'Nov 2021', ev: 'Tech Lead encargado', tag: 'Ascenso', tone: 'blu' },
    { date: 'Jun 2023', ev: 'Líder de Tecnología', tag: 'Ascenso', tone: 'vio' },
  ],
}

import type { Activo, Factura, Pedido } from '../types'

export const INVENTARIO: Activo[] = [
  { id: 1, item: 'MacBook Pro 14"', cat: 'Computador', who: 'Andrés Morales', serial: 'MBP-2024-001', st: 'Asignado', date: '2024-01-15' },
  { id: 2, item: 'Monitor LG 27"', cat: 'Monitor', who: 'Valentina Torres', serial: 'LG-27-002', st: 'Asignado', date: '2024-01-20' },
  { id: 3, item: 'iPhone 15 Pro', cat: 'Móvil', who: 'Felipe Rodríguez', serial: 'IPH-15-003', st: 'Asignado', date: '2024-02-01' },
  { id: 4, item: 'Teclado Mecánico', cat: 'Periférico', who: '', serial: 'KBD-MEC-004', st: 'Disponible', date: '2024-03-10' },
  { id: 5, item: 'Silla Ergonómica', cat: 'Mobiliario', who: 'Diego Vargas', serial: 'SILL-ERG-005', st: 'Asignado', date: '2024-03-15' },
  { id: 6, item: 'Tablet iPad Air', cat: 'Tablet', who: '', serial: 'IPAD-AIR-006', st: 'Disponible', date: '2024-04-01' },
]

export const FACTURAS: Factura[] = [
  { id: 1, proveedor: 'Apple Colombia', fecha: '2024-01-10', st: 'Pagada',
    items: [{ activo: 'MacBook Pro 14"', cant: 1, precio: 8500000 }, { activo: 'iPhone 15 Pro', cant: 1, precio: 4200000 }] },
  { id: 2, proveedor: 'LG Electronics', fecha: '2024-01-18', st: 'Pagada',
    items: [{ activo: 'Monitor LG 27"', cant: 2, precio: 1800000 }] },
  { id: 3, proveedor: 'OfficeMax', fecha: '2024-03-08', st: 'Pagada',
    items: [{ activo: 'Teclado Mecánico', cant: 3, precio: 320000 }, { activo: 'Silla Ergonómica', cant: 2, precio: 1200000 }] },
  { id: 4, proveedor: 'Apple Colombia', fecha: '2024-03-28', st: 'Pendiente',
    items: [{ activo: 'iPad Air', cant: 2, precio: 3100000 }] },
  { id: 5, proveedor: 'Lenovo Colombia', fecha: '2024-06-01', st: 'En revisión',
    items: [{ activo: 'ThinkPad X1', cant: 1, precio: 6800000 }] },
]

export const PEDIDOS: Pedido[] = [
  { id: 1, item: 'Auriculares Sony WH-1000XM5', proveedor: 'Sony Colombia', cant: 3, precioEst: 1100000, fecha: '2024-07-20', st: 'Pendiente', quien: 'Valentina Torres' },
  { id: 2, item: 'Webcam Logitech 4K', proveedor: 'Logitech', cant: 5, precioEst: 480000, fecha: '2024-07-18', st: 'En tránsito', quien: 'Andrés Morales' },
  { id: 3, item: 'Dock USB-C', proveedor: 'CalDigit', cant: 4, precioEst: 650000, fecha: '2024-07-22', st: 'Aprobado', quien: 'Diego Vargas' },
  { id: 4, item: 'Silla Gamer', proveedor: 'Secretlab', cant: 1, precioEst: 2200000, fecha: '2024-07-25', st: 'Pendiente', quien: 'Lucía Gómez' },
]

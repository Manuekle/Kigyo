'use server'

import { getCoursesPage, type CourseRow } from '@/server/queries/capacitacion'
import type { PageResult } from '@/server/queries/shared'

/** The next page of courses. See `actions/audit.ts` for why reads live here. */
export async function fetchMoreCourses(offset: number): Promise<PageResult<CourseRow>> {
  try {
    return { ok: true, data: await getCoursesPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver los cursos.' }
  }
}

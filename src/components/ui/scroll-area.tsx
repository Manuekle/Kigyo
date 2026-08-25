"use client"

import * as React from "react"
import { ScrollArea as ScrollAreaPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

type ScrollAreaProps = React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  viewportClassName?: string
  viewportProps?: React.HTMLAttributes<HTMLDivElement> & {
    ref?: React.Ref<HTMLDivElement>
  }
  viewportRef?: React.Ref<HTMLDivElement>
  scrollFade?: boolean
  orientation?: "vertical" | "horizontal" | "both"
  scrollbarGutter?: boolean
}

function setRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (!ref) return
  if (typeof ref === "function") ref(value)
  else (ref as React.MutableRefObject<T | null>).current = value
}

function ScrollArea({
  className,
  children,
  viewportClassName,
  viewportProps,
  viewportRef,
  scrollFade: _scrollFade,
  orientation = "vertical",
  scrollbarGutter: _scrollbarGutter,
  ...props
}: ScrollAreaProps) {
  const {
    className: viewportPropsClassName,
    ref: viewportPropsRef,
    style: rawViewportStyle,
    ...restViewportProps
  } = viewportProps ?? {}

  // Radix actualiza overflow-y en rerenders; si el caller pasa el shorthand
  // `overflow`, React ve shorthand+longhand mezclados y avisa. Expandir a
  // longhands una sola vez aquí evita el warning.
  const { overflow, ...restRawStyle } = rawViewportStyle ?? {}
  const expandedOverflow =
    overflow === undefined
      ? undefined
      : {
          overflowX: overflow as React.CSSProperties["overflowX"],
          overflowY: overflow as React.CSSProperties["overflowY"],
        }
  const viewportStyle: React.CSSProperties | undefined =
    expandedOverflow !== undefined
      ? { ...expandedOverflow, ...restRawStyle }
      : rawViewportStyle

  const assignViewportRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      setRef(viewportRef, node)
      setRef(viewportPropsRef, node)
    },
    [viewportRef, viewportPropsRef]
  )

  const showVertical = orientation === "vertical" || orientation === "both"
  const showHorizontal = orientation === "horizontal" || orientation === "both"

  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        ref={assignViewportRef}
        className={cn(
          "size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1",
          viewportClassName,
          viewportPropsClassName
        )}
        style={viewportStyle}
        {...restViewportProps}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      {showVertical ? <ScrollBar orientation="vertical" /> : null}
      {showHorizontal ? <ScrollBar orientation="horizontal" /> : null}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "flex touch-none p-px transition-colors select-none",
        orientation === "vertical" &&
          "h-full w-2.5 border-l border-l-transparent",
        orientation === "horizontal" &&
          "h-2.5 flex-col border-t border-t-transparent",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}

export { ScrollArea, ScrollBar }

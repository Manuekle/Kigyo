'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useInView, type HTMLMotionProps, type MotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

interface TypingAnimationProps extends Omit<MotionProps, 'children'> {
  children?: string
  words?: string[]
  className?: string
  duration?: number
  typeSpeed?: number
  deleteSpeed?: number
  delay?: number
  pauseDelay?: number
  loop?: boolean
  startOnView?: boolean
  showCursor?: boolean
  blinkCursor?: boolean
  cursorStyle?: 'line' | 'block' | 'underscore'
}

export function TypingAnimation({
  children,
  words,
  className,
  duration = 100,
  typeSpeed,
  deleteSpeed,
  delay = 0,
  pauseDelay = 1000,
  loop = false,
  startOnView = true,
  showCursor = true,
  blinkCursor = true,
  cursorStyle = 'line',
  ...props
}: TypingAnimationProps) {
  const [displayedText, setDisplayedText] = useState<string>('')
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [currentCharIndex, setCurrentCharIndex] = useState(0)
  const [phase, setPhase] = useState<'typing' | 'pause' | 'deleting'>('typing')
  const elementRef = useRef<HTMLSpanElement>(null)
  const isInView = useInView(elementRef, { amount: 0.3, once: true })

  const wordsToAnimate = useMemo(
    () => words ?? (children ? [children] : []),
    [words, children],
  )
  const hasMultipleWords = wordsToAnimate.length > 1

  const typingSpeed = typeSpeed ?? duration
  const deletingSpeed = deleteSpeed ?? typingSpeed / 2

  const shouldStart = startOnView ? isInView : true
  const animationSourceKey = useMemo(
    () => (words ? words.join('\u0000') : (children ?? '')),
    [words, children],
  )

  // Restart when the source text changes, using the store-previous-state
  // pattern rather than an effect. Resetting in an effect meant one frame of
  // the old text rendered against the new key before it cleared.
  const [prevSourceKey, setPrevSourceKey] = useState(animationSourceKey)
  if (animationSourceKey !== prevSourceKey) {
    setPrevSourceKey(animationSourceKey)
    setDisplayedText('')
    setCurrentWordIndex(0)
    setCurrentCharIndex(0)
    setPhase('typing')
  }

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null

    if (shouldStart && wordsToAnimate.length > 0) {
      const timeoutDelay =
        delay > 0 && displayedText === ''
          ? delay
          : phase === 'typing'
            ? typingSpeed
            : phase === 'deleting'
              ? deletingSpeed
              : pauseDelay

      timeout = setTimeout(() => {
        const currentWord = wordsToAnimate[currentWordIndex] || ''
        const graphemes = Array.from(currentWord)

        switch (phase) {
          case 'typing':
            if (currentCharIndex < graphemes.length) {
              setDisplayedText(
                graphemes.slice(0, currentCharIndex + 1).join(''),
              )
              setCurrentCharIndex(currentCharIndex + 1)
            } else {
              if (hasMultipleWords || loop) {
                const isLastWord =
                  currentWordIndex === wordsToAnimate.length - 1
                if (!isLastWord || loop) {
                  setPhase('pause')
                }
              }
            }
            break

          case 'pause':
            setPhase('deleting')
            break

          case 'deleting':
            if (currentCharIndex > 0) {
              setDisplayedText(
                graphemes.slice(0, currentCharIndex - 1).join(''),
              )
              setCurrentCharIndex(currentCharIndex - 1)
            } else {
              const nextIndex = (currentWordIndex + 1) % wordsToAnimate.length
              setCurrentWordIndex(nextIndex)
              setPhase('typing')
            }
            break
        }
      }, timeoutDelay)
    }

    return () => {
      if (timeout !== null) {
        clearTimeout(timeout)
      }
    }
  }, [
    shouldStart,
    phase,
    currentCharIndex,
    currentWordIndex,
    displayedText,
    wordsToAnimate,
    hasMultipleWords,
    loop,
    typingSpeed,
    deletingSpeed,
    pauseDelay,
    delay,
  ])

  const currentWordGraphemes = Array.from(
    wordsToAnimate[currentWordIndex] || '',
  )
  const isComplete =
    !loop &&
    currentWordIndex === wordsToAnimate.length - 1 &&
    currentCharIndex >= currentWordGraphemes.length &&
    phase !== 'deleting'

  const shouldShowCursor =
    showCursor &&
    !isComplete &&
    (hasMultipleWords || loop || currentCharIndex < currentWordGraphemes.length)

  const getCursorChar = () => {
    switch (cursorStyle) {
      case 'block':
        return '\u258C'
      case 'underscore':
        return '_'
      case 'line':
      default:
        return '|'
    }
  }

  return (
    <motion.span
      ref={elementRef}
      className={cn(
        'leading-7 inline-block',
        className,
      )}
      {...(props as HTMLMotionProps<'span'>)}
    >
      {displayedText}
      {shouldShowCursor && (
        <span
          className={cn('inline-block', blinkCursor && 'animate-blink-cursor')}
        >
          {getCursorChar()}
        </span>
      )}
    </motion.span>
  )
}

export default TypingAnimation

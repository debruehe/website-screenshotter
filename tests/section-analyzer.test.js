const { analyzeSections } = require('../src/main/section-analyzer')

test('returns fixed steps when no sections found', () => {
  const stops = analyzeSections([], 900, 3000)
  expect(stops[0]).toBe(0)
  expect(stops).toContain(1000)
  expect(stops).toContain(2000)
})

test('returns section-based stops when sections found', () => {
  const sections = [
    { top: 0, height: 800 },
    { top: 900, height: 700 },
    { top: 1700, height: 600 }
  ]
  const stops = analyzeSections(sections, 900, 3000)
  expect(stops).toContain(0)
  expect(stops).toContain(900)
  expect(stops).toContain(1700)
})

test('filters sections shorter than threshold', () => {
  const sections = [
    { top: 0, height: 900 },
    { top: 100, height: 50 },
    { top: 1000, height: 800 }
  ]
  const stops = analyzeSections(sections, 900, 2000)
  expect(stops).not.toContain(100)
})

test('deduplicates stops within 100px', () => {
  const sections = [
    { top: 0, height: 900 },
    { top: 50, height: 900 },
    { top: 1000, height: 900 }
  ]
  const stops = analyzeSections(sections, 900, 2000)
  const nearZero = stops.filter(s => s < 100)
  expect(nearZero).toHaveLength(1)
})

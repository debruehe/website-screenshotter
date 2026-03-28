const { filterLinks, SKIP_EXTENSIONS } = require('../src/main/crawler')

const BASE = 'https://example.com'

test('keeps same-hostname links', () => {
  const links = ['https://example.com/about', 'https://example.com/work']
  expect(filterLinks(links, BASE, [])).toEqual(links)
})

test('removes links from different hostname', () => {
  const links = ['https://other.com/page', 'https://example.com/valid']
  expect(filterLinks(links, BASE, [])).toEqual(['https://example.com/valid'])
})

test('removes subdomains', () => {
  const links = ['https://blog.example.com/post', 'https://example.com/home']
  expect(filterLinks(links, BASE, [])).toEqual(['https://example.com/home'])
})

test('removes already-visited URLs', () => {
  const links = ['https://example.com/about', 'https://example.com/new']
  expect(filterLinks(links, BASE, ['https://example.com/about'])).toEqual(['https://example.com/new'])
})

test('removes anchor variants of queued URLs', () => {
  const links = ['https://example.com/about#section', 'https://example.com/new']
  expect(filterLinks(links, BASE, ['https://example.com/about'])).toEqual(['https://example.com/new'])
})

test('removes non-HTTP links and file extensions', () => {
  const links = [
    'mailto:test@test.com',
    'https://example.com/file.pdf',
    'https://example.com/img.png',
    'https://example.com/valid'
  ]
  expect(filterLinks(links, BASE, [])).toEqual(['https://example.com/valid'])
})

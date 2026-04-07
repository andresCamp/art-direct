import { defineMiddleware } from 'astro:middleware'

export const onRequest = defineMiddleware(({ request }, next) => {
  const url = new URL(request.url)
  if (url.hostname === 'www.artdirect.dev') {
    url.hostname = 'artdirect.dev'
    return Response.redirect(url.toString(), 301)
  }
  return next()
})

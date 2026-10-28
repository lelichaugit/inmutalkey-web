// Worker de inmutalkey.com. Atiende solo /api/* y /admin* (run_worker_first en wrangler.toml); todo lo demás lo
// sirve Cloudflare directamente desde dist/ (gratis y sin invocar este código).
//
// Este backend NO toca datos clínicos ni de pacientes: solo datos comerciales de médicos interesados.

import type { ExecutionContext, ScheduledController } from '@cloudflare/workers-types/index.ts';
import { Hono } from 'hono';

import type { Contexto, Env } from './env';
import { soloAdmin } from './lib/acceso';
import { registrarError, registro } from './lib/registro';
import { cors, encabezados } from './lib/seguridad';
import { admin } from './rutas/admin';
import { google } from './rutas/google';
import { publicas } from './rutas/publicas';
import { ejecutarRetencion } from './tareas/retencion';

export function crearApp(): Hono<Contexto> {
  const app = new Hono<Contexto>();

  app.use('*', registro);
  app.use('*', encabezados);
  app.use('/api/*', cors);

  // Panel: la página la genera Astro (dist/admin.html y /_astro/*); el Worker solo la entrega a quien pasó Access.
  app.use('/admin', soloAdmin);
  app.use('/admin/*', soloAdmin);
  app.use('/api/admin/*', soloAdmin);
  app.get('/admin', (c) => c.env.ASSETS.fetch(new Request(new URL('/admin', c.req.url))));
  app.get('/admin/*', (c) => c.redirect('/admin', 302));

  app.route('/api/admin', admin);
  app.route('/api/auth', google);
  app.route('/api', publicas);

  app.notFound((c) => c.json({ error: 'no_encontrado' }, 404));
  app.onError((error, c) => {
    registrarError('no_controlado', error);
    return c.json({ error: 'interno' }, 500);
  });

  return app;
}

const app = crearApp();

export default {
  fetch: app.fetch,
  async scheduled(_controlador: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(ejecutarRetencion(env, new Date()).then(() => undefined));
  },
};

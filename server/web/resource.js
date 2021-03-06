const express = require('express');
const wrap = require('express-async-wrap');
const fs = require('fs');
const Vue = require('vue');
const createBundleRenderer = require('vue-server-renderer').createBundleRenderer;
const auth = require('./auth');
const loggers = require('../core/loggers');
const config = require('../core/config');

const router = new express.Router();
module.exports = router;

const logger = loggers.get('web/resource');
const template = fs.readFileSync(`${__dirname}/index.template.html`, 'utf-8');
const isProd = config.get('NODE_ENV') === 'production';

let readyPromise;
let renderer;

function createRenderer (bundle, options) {
  return createBundleRenderer(bundle, Object.assign(options, {
    runInNewContext: false,
    template,
  }));
}

function render(req, res, next) {
  const context = {
    title: 'Amazing!',
    url: req.url
  };

  renderer.renderToString(context, (err, html) => {
    if (err) {
      if (err.code === 404) {
        res.status(404).end('Page not found');
      } else {
        next(err);
      }
    } else {
      res.end(html);
    }
  });
}

async function handleRoute(req, res, next) {
  if (isProd) {
    render(req, res, next);
  } else {
    await readyPromise;
    render(req, res, next);
  }
}

if (isProd) {
  const serverBundle = require('../../.dist/vue-ssr-server-bundle.json');
  const clientManifest = require('../../.dist/vue-ssr-client-manifest.json');
  renderer = createRenderer(serverBundle, { clientManifest });
} else {
  const setup = require('../../build/setup-dev-server');
  readyPromise = setup(router, (bundle, options) => {
    renderer = createRenderer(bundle, options);
  });
}

auth.init(router);

router.use('/dist', express.static(`${__dirname}/../../.dist`));

router.get('/private', auth.ensureLoggedIn, wrap(handleRoute));
router.get('*', wrap(handleRoute));

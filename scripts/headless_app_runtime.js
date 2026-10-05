'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function inertNode() {
  const target = function () {};
  const children = [];
  const state = {
    hidden: false,
    open: false,
    value: '',
    checked: false,
    disabled: false,
    textContent: '',
    innerHTML: '',
    dataset: {},
    style: { setProperty() {}, removeProperty() {} },
    className: '',
    files: [],
    children,
  };
  let proxy;
  proxy = new Proxy(target, {
    get(_object, key) {
      if (key === Symbol.iterator) return children[Symbol.iterator].bind(children);
      if (key === 'then') return undefined;
      if (key === 'classList') return { add() {}, remove() {}, toggle() {}, contains() { return false; } };
      if (key === 'getContext') return () => inertNode();
      if (key === 'getBoundingClientRect') return () => ({ x: 0, y: 0, left: 0, top: 0, right: 390, bottom: 844, width: 390, height: 844 });
      if (key === 'querySelector') return () => proxy;
      if (key === 'querySelectorAll') return () => [];
      if (key === 'closest') return () => null;
      if (key === 'matches') return () => false;
      if (key === 'appendChild' || key === 'append' || key === 'prepend') return (...items) => { children.push(...items); return items.at(-1); };
      if (key === 'replaceChildren') return (...items) => { children.splice(0, children.length, ...items); };
      if (key === 'remove' || key === 'addEventListener' || key === 'removeEventListener' || key === 'focus' || key === 'blur' || key === 'click' || key === 'scrollTo' || key === 'setAttribute' || key === 'removeAttribute') return () => {};
      if (key === 'showModal') return () => { state.open = true; };
      if (key === 'close') return () => { state.open = false; };
      if (key === 'cloneNode') return () => inertNode();
      if (key === 'ownerDocument') return null;
      if (key === 'offsetHeight' || key === 'clientHeight') return 844;
      if (key === 'offsetWidth' || key === 'clientWidth') return 390;
      if (key in state) return state[key];
      return proxy;
    },
    set(_object, key, value) {
      state[key] = value;
      return true;
    },
    apply() { return proxy; },
  });
  return proxy;
}

function loadHeadlessApp(root = path.resolve(__dirname, '..')) {
  const elements = new Map();
  const storage = new Map();
  const documentNode = inertNode();
  const body = inertNode();
  const documentElement = inertNode();
  const document = {
    body,
    documentElement,
    scrollingElement: documentElement,
    readyState: 'complete',
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, inertNode());
      return elements.get(id);
    },
    createElement: () => inertNode(),
    createElementNS: () => inertNode(),
    createTextNode: value => ({ textContent: String(value) }),
    querySelector: () => inertNode(),
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
  };
  const context = {
    console,
    document,
    location: { href: 'http://127.0.0.1/', hash: '', search: '', pathname: '/' },
    history: { pushState() {}, replaceState() {} },
    navigator: { userAgent: 'node-headless-evaluation', clipboard: { async writeText() {}, async readText() { return ''; } } },
    localStorage: {
      getItem: key => storage.has(key) ? storage.get(key) : null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key),
    },
    crypto: globalThis.crypto,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    Blob,
    FileReader: class { addEventListener() {} readAsText() {} },
    CustomEvent: class { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    Event: class {},
    EventTarget: class { addEventListener() {} removeEventListener() {} dispatchEvent() { return true; } },
    HTMLElement: class {},
    HTMLDialogElement: class {},
    Node: { ELEMENT_NODE: 1 },
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    requestAnimationFrame: callback => { callback(0); return 1; },
    cancelAnimationFrame() {},
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    fetch: async () => { throw new Error('Network access is disabled in the headless app evaluator.'); },
    alert() {},
    confirm: () => true,
    performance: { now: () => Date.now() },
    innerWidth: 390,
    innerHeight: 844,
    visualViewport: { width: 390, height: 844, offsetTop: 0, addEventListener() {}, removeEventListener() {} },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
    scrollTo() {},
  };
  context.window = context;
  context.self = context;
  context.globalThis = context;
  vm.createContext(context);
  const source = fs.readFileSync(path.join(root, 'runtime.bundle.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'runtime.bundle.js', timeout: 30000 });
  if (!context.TableTennisRobotStudio) {
    throw new Error(`App runtime did not expose TableTennisRobotStudio: ${context.__TTRS_BOOT_ERROR || 'unknown startup failure'}`);
  }
  return context.TableTennisRobotStudio;
}

module.exports = { loadHeadlessApp };

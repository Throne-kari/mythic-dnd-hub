/* Runs before the original game scripts. Each game keeps its own URL and browser storage space. */
(() => {
  'use strict';
  const match = location.pathname.match(/^\/play\/([a-z0-9-]+)(?:\/|$)/);
  if (!match) return;
  const id = match[1], prefix = `/play/${id}`, namespace = `mythic-dnd:${id}:`;
  const remap = input => {
    const value = String(input);
    if (/^(?:#|data:|blob:|mailto:|tel:|javascript:)/i.test(value)) return value;
    if (value.startsWith('/') && !value.startsWith('//')) return value === prefix || value.startsWith(prefix + '/') ? value : prefix + value;
    try {
      const url = new URL(value, location.href);
      const sameHost = url.host === location.host && ['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol);
      if (sameHost && !url.pathname.startsWith(prefix + '/') && url.pathname !== prefix) {
        url.pathname = prefix + url.pathname;
        return url.href;
      }
    } catch {}
    return value;
  };
  Object.defineProperty(window, '__MYTHIC_HUB__', { value: Object.freeze({ id, prefix, home: '/', remap }) });

  if (document.querySelector('meta[name="mythic-storage"][content="ephemeral"]')) {
    document.addEventListener('DOMContentLoaded', () => {
      const warning = document.createElement('aside'), close = document.createElement('button');
      warning.id = 'mythic-storage-warning'; warning.setAttribute('role', 'note');
      warning.style.cssText = 'position:fixed;z-index:2147483647;left:12px;right:12px;bottom:12px;margin:0;padding:12px 44px 12px 16px;background:#493b22;color:#fff0cd;border:1px solid #9e7f43;border-radius:8px;font:14px/1.6 system-ui,sans-serif;box-shadow:0 3px 20px #0008;';
      warning.append(document.createTextNode('免费临时联机版：服务空闲后会休眠，首次访问可能需要约一分钟唤醒；休眠、重启或部署会清空房间和存档。请勿用于长期存档。'));
      close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', '关闭临时存档提示');
      close.style.cssText = 'position:absolute;right:8px;top:6px;min-width:32px;min-height:32px;border:0;background:transparent;color:inherit;font:24px system-ui;cursor:pointer;';
      close.addEventListener('click', () => warning.remove()); warning.append(close); document.body.append(warning);
    }, { once: true });
  }

  for (const name of ['localStorage', 'sessionStorage']) {
    try {
      const store = window[name];
      const keys = () => Array.from({ length: store.length }, (_, index) => store.key(index)).filter(key => key?.startsWith(namespace));
      const methods = {
        getItem: key => store.getItem(namespace + String(key)),
        setItem: (key, value) => store.setItem(namespace + String(key), String(value)),
        removeItem: key => store.removeItem(namespace + String(key)),
        clear: () => keys().forEach(key => store.removeItem(key)),
        key: index => keys()[Number(index)]?.slice(namespace.length) ?? null,
      };
      const scoped = new Proxy(methods, {
        get(target, property) { if (property === 'length') return keys().length; if (property === Symbol.toStringTag) return 'Storage'; if (typeof property === 'symbol') return undefined; return Object.hasOwn(target, property) ? target[property] : target.getItem(property) ?? undefined; },
        set(target, property, value) { target.setItem(property, value); return true; },
        deleteProperty(target, property) { target.removeItem(property); return true; },
        ownKeys() { return keys().map(key => key.slice(namespace.length)); },
        getOwnPropertyDescriptor(target, property) { if (target.getItem(property) != null) return { enumerable: true, configurable: true, writable: true, value: target.getItem(property) }; },
        has(target, property) { return Object.hasOwn(target, property) || target.getItem(property) != null; },
      });
      Object.defineProperty(window, name, { configurable: true, get: () => scoped });
    } catch (error) { console.warn('游戏浏览器存储不可用', error.name); }
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (input instanceof Request) {
      const next = remap(input.url);
      return originalFetch(next === input.url ? input : new Request(next, input), init);
    }
    return originalFetch(remap(input), init);
  };
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) { return open.call(this, method, remap(url), ...rest); };
  if (window.EventSource) {
    const Native = window.EventSource;
    window.EventSource = class EventSource extends Native { constructor(url, options) { super(remap(url), options); } };
  }
  if (window.WebSocket) {
    const Native = window.WebSocket;
    window.WebSocket = class WebSocket extends Native { constructor(url, protocols) { super(remap(url), ...(protocols === undefined ? [] : [protocols])); } };
  }
  if (navigator.sendBeacon) {
    const original = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, data) => original(remap(url), data);
  }
  const originalOpen = window.open.bind(window);
  window.open = (url, ...options) => originalOpen(url ? remap(url) : url, ...options);
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method].bind(history);
    history[method] = (state, title, url) => original(state, title, url == null ? url : remap(url));
  }

  const attributes = ['src', 'href', 'action', 'poster'];
  const fixElement = element => {
    if (!(element instanceof Element) || element.hasAttribute('data-hub-link')) return;
    for (const attribute of attributes) {
      const value = element.getAttribute(attribute);
      if (value?.startsWith('/') && !value.startsWith('//') && value !== prefix && !value.startsWith(prefix + '/')) element.setAttribute(attribute, prefix + value);
    }
  };
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') fixElement(record.target);
      for (const node of record.addedNodes) if (node instanceof Element) { fixElement(node); node.querySelectorAll('[src],[href],[action],[poster]').forEach(fixElement); }
    }
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: attributes });
  document.addEventListener('click', event => {
    const anchor = event.target.closest?.('a[href]');
    if (anchor) fixElement(anchor);
  }, true);
})();

// Small hack to save RAM.
// This will work smoothly, because the script does not use
// any "ns" functions, it's a pure browser automation tool.
const wnd = eval("window");
const doc = wnd["document"];

/**
 * Returns a list of DOM elements from the main game
 * container.
 */
export function getEl(parent, selector) {
	let prefix = ":scope";

	if ("string" === typeof parent) {
		selector = parent;
		parent = doc;

		prefix = ".MuiBox-root>.MuiBox-root>.MuiBox-root";

		if (!doc.querySelectorAll(prefix).length) {
			prefix = ".MuiBox-root>.MuiBox-root>.MuiGrid-root";
		}
		if (!doc.querySelectorAll(prefix).length) {
			prefix = ".MuiContainer-root>.MuiPaper-root";
		}
		if (!doc.querySelectorAll(prefix).length) {
			return [];
		}
	}

	selector = selector.split(",");
	selector = selector.map((item) => `${prefix} ${item}`);
	selector = selector.join(",");

	return parent.querySelectorAll(selector);
}

/**
 * Returns the first element with matching text content.
 */
export function filterByText(elements, text) {
	text = text.toLowerCase();

	for (let i = 0; i < elements.length; i++) {
		const content = elements[i].textContent.toLowerCase();

		if (-1 !== content.indexOf(text)) {
			return elements[i];
		}
	}

	return null;
}

/**
 * Returns an array with the text-contents of the given elements.
 *
 * @param {NodeList} elements
 * @returns {string[]}
 */
export function getLines(elements) {
	const lines = [];
	elements.forEach((el) => lines.push(el.textContent));

	return lines;
}

/**
 * Simulate a keyboard event (keydown + keyup).
 *
 * @param {string|int} keyOrCode A single letter (string) or key-code to send.
 */
export function pressKey(keyOrCode) {
	let keyCode = 0;
	let key = "";

	if ("string" === typeof keyOrCode && keyOrCode.length > 0) {
		key = keyOrCode.toLowerCase().substr(0, 1);
		keyCode = key.charCodeAt(0);
	} else if ("number" === typeof keyOrCode) {
		keyCode = keyOrCode;
		key = String.fromCharCode(keyCode);
	}

	if (!keyCode || key.length !== 1) {
		return;
	}

	function sendEvent(event) {
		const keyboardEvent = new KeyboardEvent(event, {
			key,
			keyCode,
		});

		doc.dispatchEvent(keyboardEvent);
	}

	sendEvent("keydown");
}

/**
 * Wrap all event listeners with a custom function that injects
 * the "isTrusted" flag.
 *
 * Is this cheating? Or is it real hacking? Don't care, as long
 * as it's working :)
 */
export function wrapEventListeners() {
	if (!doc._addEventListener) {
		doc._addEventListener = doc.addEventListener;

		doc.addEventListener = function (type, callback, options) {
			if ("undefined" === typeof options) {
				options = false;
			}
			let handler = false;

			// For this script, we only want to modify "keydown" events.
			if ("keydown" === type) {
				handler = function (...args) {
					if (!args[0].isTrusted) {
						const hackedEv = {};

						for (const key in args[0]) {
							if ("isTrusted" === key) {
								hackedEv.isTrusted = true;
							} else if ("function" === typeof args[0][key]) {
								hackedEv[key] = args[0][key].bind(args[0]);
							} else {
								hackedEv[key] = args[0][key];
							}
						}

						args[0] = hackedEv;
					}

					return callback.apply(callback, args);
				};

				for (const prop in callback) {
					if ("function" === typeof callback[prop]) {
						handler[prop] = callback[prop].bind(callback);
					} else {
						handler[prop] = callback[prop];
					}
				}
			}

			if (!this.eventListeners) {
				this.eventListeners = {};
			}
			if (!this.eventListeners[type]) {
				this.eventListeners[type] = [];
			}
			this.eventListeners[type].push({
				listener: callback,
				useCapture: options,
				wrapped: handler,
			});

			return this._addEventListener(
				type,
				handler ? handler : callback,
				options
			);
		};
	}

	if (!doc._removeEventListener) {
		doc._removeEventListener = doc.removeEventListener;

		doc.removeEventListener = function (type, callback, options) {
			if ("undefined" === typeof options) {
				options = false;
			}

			if (!this.eventListeners) {
				this.eventListeners = {};
			}
			if (!this.eventListeners[type]) {
				this.eventListeners[type] = [];
			}

			for (let i = 0; i < this.eventListeners[type].length; i++) {
				if (
					this.eventListeners[type][i].listener === callback &&
					this.eventListeners[type][i].useCapture === options
				) {
					if (this.eventListeners[type][i].wrapped) {
						callback = this.eventListeners[type][i].wrapped;
					}

					this.eventListeners[type].splice(i, 1);
					break;
				}
			}

			if (this.eventListeners[type].length == 0) {
				delete this.eventListeners[type];
			}

			return this._removeEventListener(type, callback, options);
		};
	}
}

/**
 * Revert the "wrapEventListeners" changes.
 */
export function unwrapEventListeners() {
	if (doc._addEventListener) {
		doc.addEventListener = doc._addEventListener;
		delete doc._addEventListener;
	}
	if (doc._removeEventListener) {
		doc.removeEventListener = doc._removeEventListener;
		delete doc._removeEventListener;
	}
	delete doc.eventListeners;
}
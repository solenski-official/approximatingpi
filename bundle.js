(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  for (var i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(
      uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)
    ))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

},{}],2:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = { __proto__: Uint8Array.prototype, foo: function () { return 42 } }
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species != null &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayLike(value)
  }

  if (value == null) {
    throw TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  var valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  var b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(
      value[Symbol.toPrimitive]('string'), encodingOrOffset, length
    )
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
}

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength)
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength)
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      buf = Buffer.from(buf)
    }
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  var len = string.length
  var mustMatch = (arguments.length > 2 && arguments[2] === true)
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength)
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
          : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (var i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding)
    var len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

},{"base64-js":1,"ieee754":4}],3:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var objectCreate = Object.create || objectCreatePolyfill
var objectKeys = Object.keys || objectKeysPolyfill
var bind = Function.prototype.bind || functionBindPolyfill

function EventEmitter() {
  if (!this._events || !Object.prototype.hasOwnProperty.call(this, '_events')) {
    this._events = objectCreate(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

var hasDefineProperty;
try {
  var o = {};
  if (Object.defineProperty) Object.defineProperty(o, 'x', { value: 0 });
  hasDefineProperty = o.x === 0;
} catch (err) { hasDefineProperty = false }
if (hasDefineProperty) {
  Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
    enumerable: true,
    get: function() {
      return defaultMaxListeners;
    },
    set: function(arg) {
      // check whether the input is a positive number (whose value is zero or
      // greater and not a NaN).
      if (typeof arg !== 'number' || arg < 0 || arg !== arg)
        throw new TypeError('"defaultMaxListeners" must be a positive number');
      defaultMaxListeners = arg;
    }
  });
} else {
  EventEmitter.defaultMaxListeners = defaultMaxListeners;
}

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n))
    throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};

function $getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
  if (isFn)
    handler.call(self);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn)
    handler.call(self, arg1);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn)
    handler.call(self, arg1, arg2);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn)
    handler.call(self, arg1, arg2, arg3);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2, arg3);
  }
}

function emitMany(handler, isFn, self, args) {
  if (isFn)
    handler.apply(self, args);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].apply(self, args);
  }
}

EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events;
  var doError = (type === 'error');

  events = this._events;
  if (events)
    doError = (doError && events.error == null);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    if (arguments.length > 1)
      er = arguments[1];
    if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      // At least give some kind of context to the user
      var err = new Error('Unhandled "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }

  handler = events[type];

  if (!handler)
    return false;

  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
      // fast cases
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
      // slower
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');

  events = target._events;
  if (!events) {
    events = target._events = objectCreate(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener) {
      target.emit('newListener', type,
          listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (!existing) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
          prepend ? [listener, existing] : [existing, listener];
    } else {
      // If we've already got an array, just append.
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }

    // Check for listener leak
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' +
            existing.length + ' "' + String(type) + '" listeners ' +
            'added. Use emitter.setMaxListeners() to ' +
            'increase limit.');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        if (typeof console === 'object' && console.warn) {
          console.warn('%s: %s', w.name, w.message);
        }
      }
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    switch (arguments.length) {
      case 0:
        return this.listener.call(this.target);
      case 1:
        return this.listener.call(this.target, arguments[0]);
      case 2:
        return this.listener.call(this.target, arguments[0], arguments[1]);
      case 3:
        return this.listener.call(this.target, arguments[0], arguments[1],
            arguments[2]);
      default:
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; ++i)
          args[i] = arguments[i];
        this.listener.apply(this.target, args);
    }
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = bind.call(onceWrapper, state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');

      events = this._events;
      if (!events)
        return this;

      list = events[type];
      if (!list)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = objectCreate(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else
          spliceOne(list, position);

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (!events)
        return this;

      // not listening for removeListener, no need to emit
      if (!events.removeListener) {
        if (arguments.length === 0) {
          this._events = objectCreate(null);
          this._eventsCount = 0;
        } else if (events[type]) {
          if (--this._eventsCount === 0)
            this._events = objectCreate(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = objectKeys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = objectCreate(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (!events)
    return [];

  var evlistener = events[type];
  if (!evlistener)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ? unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
    list[i] = list[k];
  list.pop();
}

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function objectCreatePolyfill(proto) {
  var F = function() {};
  F.prototype = proto;
  return new F;
}
function objectKeysPolyfill(obj) {
  var keys = [];
  for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) {
    keys.push(k);
  }
  return k;
}
function functionBindPolyfill(context) {
  var fn = this;
  return function () {
    return fn.apply(context, arguments);
  };
}

},{}],4:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],5:[function(require,module,exports){
/*
 * anime.js v3.0.1
 * (c) 2019 Julian Garnier
 * Released under the MIT license
 * animejs.com
 */

'use strict';

// Defaults

var defaultInstanceSettings = {
  update: null,
  begin: null,
  loopBegin: null,
  changeBegin: null,
  change: null,
  changeComplete: null,
  loopComplete: null,
  complete: null,
  loop: 1,
  direction: 'normal',
  autoplay: true,
  timelineOffset: 0
};

var defaultTweenSettings = {
  duration: 1000,
  delay: 0,
  endDelay: 0,
  easing: 'easeOutElastic(1, .5)',
  round: 0
};

var validTransforms = ['translateX', 'translateY', 'translateZ', 'rotate', 'rotateX', 'rotateY', 'rotateZ', 'scale', 'scaleX', 'scaleY', 'scaleZ', 'skew', 'skewX', 'skewY', 'perspective'];

// Caching

var cache = {
  CSS: {},
  springs: {}
};

// Utils

function minMax(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function stringContains(str, text) {
  return str.indexOf(text) > -1;
}

function applyArguments(func, args) {
  return func.apply(null, args);
}

var is = {
  arr: function (a) { return Array.isArray(a); },
  obj: function (a) { return stringContains(Object.prototype.toString.call(a), 'Object'); },
  pth: function (a) { return is.obj(a) && a.hasOwnProperty('totalLength'); },
  svg: function (a) { return a instanceof SVGElement; },
  inp: function (a) { return a instanceof HTMLInputElement; },
  dom: function (a) { return a.nodeType || is.svg(a); },
  str: function (a) { return typeof a === 'string'; },
  fnc: function (a) { return typeof a === 'function'; },
  und: function (a) { return typeof a === 'undefined'; },
  hex: function (a) { return /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(a); },
  rgb: function (a) { return /^rgb/.test(a); },
  hsl: function (a) { return /^hsl/.test(a); },
  col: function (a) { return (is.hex(a) || is.rgb(a) || is.hsl(a)); },
  key: function (a) { return !defaultInstanceSettings.hasOwnProperty(a) && !defaultTweenSettings.hasOwnProperty(a) && a !== 'targets' && a !== 'keyframes'; }
};

// Easings

function parseEasingParameters(string) {
  var match = /\(([^)]+)\)/.exec(string);
  return match ? match[1].split(',').map(function (p) { return parseFloat(p); }) : [];
}

// Spring solver inspired by Webkit Copyright © 2016 Apple Inc. All rights reserved. https://webkit.org/demos/spring/spring.js

function spring(string, duration) {

  var params = parseEasingParameters(string);
  var mass = minMax(is.und(params[0]) ? 1 : params[0], .1, 100);
  var stiffness = minMax(is.und(params[1]) ? 100 : params[1], .1, 100);
  var damping = minMax(is.und(params[2]) ? 10 : params[2], .1, 100);
  var velocity =  minMax(is.und(params[3]) ? 0 : params[3], .1, 100);
  var w0 = Math.sqrt(stiffness / mass);
  var zeta = damping / (2 * Math.sqrt(stiffness * mass));
  var wd = zeta < 1 ? w0 * Math.sqrt(1 - zeta * zeta) : 0;
  var a = 1;
  var b = zeta < 1 ? (zeta * w0 + -velocity) / wd : -velocity + w0;

  function solver(t) {
    var progress = duration ? (duration * t) / 1000 : t;
    if (zeta < 1) {
      progress = Math.exp(-progress * zeta * w0) * (a * Math.cos(wd * progress) + b * Math.sin(wd * progress));
    } else {
      progress = (a + b * progress) * Math.exp(-progress * w0);
    }
    if (t === 0 || t === 1) { return t; }
    return 1 - progress;
  }

  function getDuration() {
    var cached = cache.springs[string];
    if (cached) { return cached; }
    var frame = 1/6;
    var elapsed = 0;
    var rest = 0;
    while(true) {
      elapsed += frame;
      if (solver(elapsed) === 1) {
        rest++;
        if (rest >= 16) { break; }
      } else {
        rest = 0;
      }
    }
    var duration = elapsed * frame * 1000;
    cache.springs[string] = duration;
    return duration;
  }

  return duration ? solver : getDuration;

}

// Elastic easing adapted from jQueryUI http://api.jqueryui.com/easings/

function elastic(amplitude, period) {
  if ( amplitude === void 0 ) amplitude = 1;
  if ( period === void 0 ) period = .5;

  var a = minMax(amplitude, 1, 10);
  var p = minMax(period, .1, 2);
  return function (t) {
    return (t === 0 || t === 1) ? t : 
      -a * Math.pow(2, 10 * (t - 1)) * Math.sin((((t - 1) - (p / (Math.PI * 2) * Math.asin(1 / a))) * (Math.PI * 2)) / p);
  }
}

// Basic steps easing implementation https://developer.mozilla.org/fr/docs/Web/CSS/transition-timing-function

function steps(steps) {
  if ( steps === void 0 ) steps = 10;

  return function (t) { return Math.round(t * steps) * (1 / steps); };
}

// BezierEasing https://github.com/gre/bezier-easing

var bezier = (function () {

  var kSplineTableSize = 11;
  var kSampleStepSize = 1.0 / (kSplineTableSize - 1.0);

  function A(aA1, aA2) { return 1.0 - 3.0 * aA2 + 3.0 * aA1 }
  function B(aA1, aA2) { return 3.0 * aA2 - 6.0 * aA1 }
  function C(aA1)      { return 3.0 * aA1 }

  function calcBezier(aT, aA1, aA2) { return ((A(aA1, aA2) * aT + B(aA1, aA2)) * aT + C(aA1)) * aT }
  function getSlope(aT, aA1, aA2) { return 3.0 * A(aA1, aA2) * aT * aT + 2.0 * B(aA1, aA2) * aT + C(aA1) }

  function binarySubdivide(aX, aA, aB, mX1, mX2) {
    var currentX, currentT, i = 0;
    do {
      currentT = aA + (aB - aA) / 2.0;
      currentX = calcBezier(currentT, mX1, mX2) - aX;
      if (currentX > 0.0) { aB = currentT; } else { aA = currentT; }
    } while (Math.abs(currentX) > 0.0000001 && ++i < 10);
    return currentT;
  }

  function newtonRaphsonIterate(aX, aGuessT, mX1, mX2) {
    for (var i = 0; i < 4; ++i) {
      var currentSlope = getSlope(aGuessT, mX1, mX2);
      if (currentSlope === 0.0) { return aGuessT; }
      var currentX = calcBezier(aGuessT, mX1, mX2) - aX;
      aGuessT -= currentX / currentSlope;
    }
    return aGuessT;
  }

  function bezier(mX1, mY1, mX2, mY2) {

    if (!(0 <= mX1 && mX1 <= 1 && 0 <= mX2 && mX2 <= 1)) { return; }
    var sampleValues = new Float32Array(kSplineTableSize);

    if (mX1 !== mY1 || mX2 !== mY2) {
      for (var i = 0; i < kSplineTableSize; ++i) {
        sampleValues[i] = calcBezier(i * kSampleStepSize, mX1, mX2);
      }
    }

    function getTForX(aX) {

      var intervalStart = 0;
      var currentSample = 1;
      var lastSample = kSplineTableSize - 1;

      for (; currentSample !== lastSample && sampleValues[currentSample] <= aX; ++currentSample) {
        intervalStart += kSampleStepSize;
      }

      --currentSample;

      var dist = (aX - sampleValues[currentSample]) / (sampleValues[currentSample + 1] - sampleValues[currentSample]);
      var guessForT = intervalStart + dist * kSampleStepSize;
      var initialSlope = getSlope(guessForT, mX1, mX2);

      if (initialSlope >= 0.001) {
        return newtonRaphsonIterate(aX, guessForT, mX1, mX2);
      } else if (initialSlope === 0.0) {
        return guessForT;
      } else {
        return binarySubdivide(aX, intervalStart, intervalStart + kSampleStepSize, mX1, mX2);
      }

    }

    return function (x) {
      if (mX1 === mY1 && mX2 === mY2) { return x; }
      if (x === 0 || x === 1) { return x; }
      return calcBezier(getTForX(x), mY1, mY2);
    }

  }

  return bezier;

})();

var penner = (function () {

  var names = ['Quad', 'Cubic', 'Quart', 'Quint', 'Sine', 'Expo', 'Circ', 'Back', 'Elastic'];

  // Approximated Penner equations http://matthewlein.com/ceaser/

  var curves = {
    In: [
      [0.550, 0.085, 0.680, 0.530], /* inQuad */
      [0.550, 0.055, 0.675, 0.190], /* inCubic */
      [0.895, 0.030, 0.685, 0.220], /* inQuart */
      [0.755, 0.050, 0.855, 0.060], /* inQuint */
      [0.470, 0.000, 0.745, 0.715], /* inSine */
      [0.950, 0.050, 0.795, 0.035], /* inExpo */
      [0.600, 0.040, 0.980, 0.335], /* inCirc */
      [0.600,-0.280, 0.735, 0.045], /* inBack */
      elastic /* inElastic */
    ],
    Out: [
      [0.250, 0.460, 0.450, 0.940], /* outQuad */
      [0.215, 0.610, 0.355, 1.000], /* outCubic */
      [0.165, 0.840, 0.440, 1.000], /* outQuart */
      [0.230, 1.000, 0.320, 1.000], /* outQuint */
      [0.390, 0.575, 0.565, 1.000], /* outSine */
      [0.190, 1.000, 0.220, 1.000], /* outExpo */
      [0.075, 0.820, 0.165, 1.000], /* outCirc */
      [0.175, 0.885, 0.320, 1.275], /* outBack */
      function (a, p) { return function (t) { return 1 - elastic(a, p)(1 - t); }; } /* outElastic */
    ],
    InOut: [
      [0.455, 0.030, 0.515, 0.955], /* inOutQuad */
      [0.645, 0.045, 0.355, 1.000], /* inOutCubic */
      [0.770, 0.000, 0.175, 1.000], /* inOutQuart */
      [0.860, 0.000, 0.070, 1.000], /* inOutQuint */
      [0.445, 0.050, 0.550, 0.950], /* inOutSine */
      [1.000, 0.000, 0.000, 1.000], /* inOutExpo */
      [0.785, 0.135, 0.150, 0.860], /* inOutCirc */
      [0.680,-0.550, 0.265, 1.550], /* inOutBack */
      function (a, p) { return function (t) { return t < .5 ? elastic(a, p)(t * 2) / 2 : 1 - elastic(a, p)(t * -2 + 2) / 2; }; } /* inOutElastic */
    ]
  };

  var eases = { 
    linear: [0.250, 0.250, 0.750, 0.750]
  };

  var loop = function ( coords ) {
    curves[coords].forEach(function (ease, i) {
      eases['ease'+coords+names[i]] = ease;
    });
  };

  for (var coords in curves) loop( coords );

  return eases;

})();

function parseEasings(easing, duration) {
  if (is.fnc(easing)) { return easing; }
  var name = easing.split('(')[0];
  var ease = penner[name];
  var args = parseEasingParameters(easing);
  switch (name) {
    case 'spring' : return spring(easing, duration);
    case 'cubicBezier' : return applyArguments(bezier, args);
    case 'steps' : return applyArguments(steps, args);
    default : return is.fnc(ease) ? applyArguments(ease, args) : applyArguments(bezier, ease);
  }
}

// Strings

function selectString(str) {
  try {
    var nodes = document.querySelectorAll(str);
    return nodes;
  } catch(e) {
    return;
  }
}

// Arrays

function filterArray(arr, callback) {
  var len = arr.length;
  var thisArg = arguments.length >= 2 ? arguments[1] : void 0;
  var result = [];
  for (var i = 0; i < len; i++) {
    if (i in arr) {
      var val = arr[i];
      if (callback.call(thisArg, val, i, arr)) {
        result.push(val);
      }
    }
  }
  return result;
}

function flattenArray(arr) {
  return arr.reduce(function (a, b) { return a.concat(is.arr(b) ? flattenArray(b) : b); }, []);
}

function toArray(o) {
  if (is.arr(o)) { return o; }
  if (is.str(o)) { o = selectString(o) || o; }
  if (o instanceof NodeList || o instanceof HTMLCollection) { return [].slice.call(o); }
  return [o];
}

function arrayContains(arr, val) {
  return arr.some(function (a) { return a === val; });
}

// Objects

function cloneObject(o) {
  var clone = {};
  for (var p in o) { clone[p] = o[p]; }
  return clone;
}

function replaceObjectProps(o1, o2) {
  var o = cloneObject(o1);
  for (var p in o1) { o[p] = o2.hasOwnProperty(p) ? o2[p] : o1[p]; }
  return o;
}

function mergeObjects(o1, o2) {
  var o = cloneObject(o1);
  for (var p in o2) { o[p] = is.und(o1[p]) ? o2[p] : o1[p]; }
  return o;
}

// Colors

function rgbToRgba(rgbValue) {
  var rgb = /rgb\((\d+,\s*[\d]+,\s*[\d]+)\)/g.exec(rgbValue);
  return rgb ? ("rgba(" + (rgb[1]) + ",1)") : rgbValue;
}

function hexToRgba(hexValue) {
  var rgx = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  var hex = hexValue.replace(rgx, function (m, r, g, b) { return r + r + g + g + b + b; } );
  var rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  var r = parseInt(rgb[1], 16);
  var g = parseInt(rgb[2], 16);
  var b = parseInt(rgb[3], 16);
  return ("rgba(" + r + "," + g + "," + b + ",1)");
}

function hslToRgba(hslValue) {
  var hsl = /hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/g.exec(hslValue) || /hsla\((\d+),\s*([\d.]+)%,\s*([\d.]+)%,\s*([\d.]+)\)/g.exec(hslValue);
  var h = parseInt(hsl[1], 10) / 360;
  var s = parseInt(hsl[2], 10) / 100;
  var l = parseInt(hsl[3], 10) / 100;
  var a = hsl[4] || 1;
  function hue2rgb(p, q, t) {
    if (t < 0) { t += 1; }
    if (t > 1) { t -= 1; }
    if (t < 1/6) { return p + (q - p) * 6 * t; }
    if (t < 1/2) { return q; }
    if (t < 2/3) { return p + (q - p) * (2/3 - t) * 6; }
    return p;
  }
  var r, g, b;
  if (s == 0) {
    r = g = b = l;
  } else {
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return ("rgba(" + (r * 255) + "," + (g * 255) + "," + (b * 255) + "," + a + ")");
}

function colorToRgb(val) {
  if (is.rgb(val)) { return rgbToRgba(val); }
  if (is.hex(val)) { return hexToRgba(val); }
  if (is.hsl(val)) { return hslToRgba(val); }
}

// Units

function getUnit(val) {
  var split = /([\+\-]?[0-9#\.]+)(%|px|pt|em|rem|in|cm|mm|ex|ch|pc|vw|vh|vmin|vmax|deg|rad|turn)?$/.exec(val);
  if (split) { return split[2]; }
}

function getTransformUnit(propName) {
  if (stringContains(propName, 'translate') || propName === 'perspective') { return 'px'; }
  if (stringContains(propName, 'rotate') || stringContains(propName, 'skew')) { return 'deg'; }
}

// Values

function getFunctionValue(val, animatable) {
  if (!is.fnc(val)) { return val; }
  return val(animatable.target, animatable.id, animatable.total);
}

function getAttribute(el, prop) {
  return el.getAttribute(prop);
}

function convertPxToUnit(el, value, unit) {
  var valueUnit = getUnit(value);
  if (arrayContains([unit, 'deg', 'rad', 'turn'], valueUnit)) { return value; }
  var cached = cache.CSS[value + unit];
  if (!is.und(cached)) { return cached; }
  var baseline = 100;
  var tempEl = document.createElement(el.tagName);
  var parentEl = (el.parentNode && (el.parentNode !== document)) ? el.parentNode : document.body;
  parentEl.appendChild(tempEl);
  tempEl.style.position = 'absolute';
  tempEl.style.width = baseline + unit;
  var factor = baseline / tempEl.offsetWidth;
  parentEl.removeChild(tempEl);
  var convertedUnit = factor * parseFloat(value);
  cache.CSS[value + unit] = convertedUnit;
  return convertedUnit;
}

function getCSSValue(el, prop, unit) {
  if (prop in el.style) {
    var uppercasePropName = prop.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    var value = el.style[prop] || getComputedStyle(el).getPropertyValue(uppercasePropName) || '0';
    return unit ? convertPxToUnit(el, value, unit) : value;
  }
}

function getAnimationType(el, prop) {
  if (is.dom(el) && !is.inp(el) && (getAttribute(el, prop) || (is.svg(el) && el[prop]))) { return 'attribute'; }
  if (is.dom(el) && arrayContains(validTransforms, prop)) { return 'transform'; }
  if (is.dom(el) && (prop !== 'transform' && getCSSValue(el, prop))) { return 'css'; }
  if (el[prop] != null) { return 'object'; }
}

function getElementTransforms(el) {
  if (!is.dom(el)) { return; }
  var str = el.style.transform || '';
  var reg  = /(\w+)\(([^)]*)\)/g;
  var transforms = new Map();
  var m; while (m = reg.exec(str)) { transforms.set(m[1], m[2]); }
  return transforms;
}

function getTransformValue(el, propName, animatable, unit) {
  var defaultVal = stringContains(propName, 'scale') ? 1 : 0 + getTransformUnit(propName);
  var value = getElementTransforms(el).get(propName) || defaultVal;
  if (animatable) {
    animatable.transforms.list.set(propName, value);
    animatable.transforms['last'] = propName;
  }
  return unit ? convertPxToUnit(el, value, unit) : value;
}

function getOriginalTargetValue(target, propName, unit, animatable) {
  switch (getAnimationType(target, propName)) {
    case 'transform': return getTransformValue(target, propName, animatable, unit);
    case 'css': return getCSSValue(target, propName, unit);
    case 'attribute': return getAttribute(target, propName);
    default: return target[propName] || 0;
  }
}

function getRelativeValue(to, from) {
  var operator = /^(\*=|\+=|-=)/.exec(to);
  if (!operator) { return to; }
  var u = getUnit(to) || 0;
  var x = parseFloat(from);
  var y = parseFloat(to.replace(operator[0], ''));
  switch (operator[0][0]) {
    case '+': return x + y + u;
    case '-': return x - y + u;
    case '*': return x * y + u;
  }
}

function validateValue(val, unit) {
  if (is.col(val)) { return colorToRgb(val); }
  var originalUnit = getUnit(val);
  var unitLess = originalUnit ? val.substr(0, val.length - originalUnit.length) : val;
  return unit && !/\s/g.test(val) ? unitLess + unit : unitLess;
}

// getTotalLength() equivalent for circle, rect, polyline, polygon and line shapes
// adapted from https://gist.github.com/SebLambla/3e0550c496c236709744

function getDistance(p1, p2) {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

function getCircleLength(el) {
  return Math.PI * 2 * getAttribute(el, 'r');
}

function getRectLength(el) {
  return (getAttribute(el, 'width') * 2) + (getAttribute(el, 'height') * 2);
}

function getLineLength(el) {
  return getDistance(
    {x: getAttribute(el, 'x1'), y: getAttribute(el, 'y1')}, 
    {x: getAttribute(el, 'x2'), y: getAttribute(el, 'y2')}
  );
}

function getPolylineLength(el) {
  var points = el.points;
  var totalLength = 0;
  var previousPos;
  for (var i = 0 ; i < points.numberOfItems; i++) {
    var currentPos = points.getItem(i);
    if (i > 0) { totalLength += getDistance(previousPos, currentPos); }
    previousPos = currentPos;
  }
  return totalLength;
}

function getPolygonLength(el) {
  var points = el.points;
  return getPolylineLength(el) + getDistance(points.getItem(points.numberOfItems - 1), points.getItem(0));
}

// Path animation

function getTotalLength(el) {
  if (el.getTotalLength) { return el.getTotalLength(); }
  switch(el.tagName.toLowerCase()) {
    case 'circle': return getCircleLength(el);
    case 'rect': return getRectLength(el);
    case 'line': return getLineLength(el);
    case 'polyline': return getPolylineLength(el);
    case 'polygon': return getPolygonLength(el);
  }
}

function setDashoffset(el) {
  var pathLength = getTotalLength(el);
  el.setAttribute('stroke-dasharray', pathLength);
  return pathLength;
}

// Motion path

function getParentSvgEl(el) {
  var parentEl = el.parentNode;
  while (is.svg(parentEl)) {
    parentEl = parentEl.parentNode;
    if (!is.svg(parentEl.parentNode)) { break; }
  }
  return parentEl;
}

function getParentSvg(pathEl, svgData) {
  var svg = svgData || {};
  var parentSvgEl = svg.el || getParentSvgEl(pathEl);
  var rect = parentSvgEl.getBoundingClientRect();
  var viewBoxAttr = getAttribute(parentSvgEl, 'viewBox');
  var width = rect.width;
  var height = rect.height;
  var viewBox = svg.viewBox || (viewBoxAttr ? viewBoxAttr.split(' ') : [0, 0, width, height]);
  return {
    el: parentSvgEl,
    viewBox: viewBox,
    x: viewBox[0] / 1,
    y: viewBox[1] / 1,
    w: width / viewBox[2],
    h: height / viewBox[3]
  }
}

function getPath(path, percent) {
  var pathEl = is.str(path) ? selectString(path)[0] : path;
  var p = percent || 100;
  return function(property) {
    return {
      property: property,
      el: pathEl,
      svg: getParentSvg(pathEl),
      totalLength: getTotalLength(pathEl) * (p / 100)
    }
  }
}

function getPathProgress(path, progress) {
  function point(offset) {
    if ( offset === void 0 ) offset = 0;

    var l = progress + offset >= 1 ? progress + offset : 0;
    return path.el.getPointAtLength(l);
  }
  var svg = getParentSvg(path.el, path.svg);
  var p = point();
  var p0 = point(-1);
  var p1 = point(+1);
  switch (path.property) {
    case 'x': return (p.x - svg.x) * svg.w;
    case 'y': return (p.y - svg.y) * svg.h;
    case 'angle': return Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI;
  }
}

// Decompose value

function decomposeValue(val, unit) {
  var rgx = /-?\d*\.?\d+/g;
  var value = validateValue((is.pth(val) ? val.totalLength : val), unit) + '';
  return {
    original: value,
    numbers: value.match(rgx) ? value.match(rgx).map(Number) : [0],
    strings: (is.str(val) || unit) ? value.split(rgx) : []
  }
}

// Animatables

function parseTargets(targets) {
  var targetsArray = targets ? (flattenArray(is.arr(targets) ? targets.map(toArray) : toArray(targets))) : [];
  return filterArray(targetsArray, function (item, pos, self) { return self.indexOf(item) === pos; });
}

function getAnimatables(targets) {
  var parsed = parseTargets(targets);
  return parsed.map(function (t, i) {
    return {target: t, id: i, total: parsed.length, transforms: { list: getElementTransforms(t) } };
  });
}

// Properties

function normalizePropertyTweens(prop, tweenSettings) {
  var settings = cloneObject(tweenSettings);
  // Override duration if easing is a spring
  if (/^spring/.test(settings.easing)) { settings.duration = spring(settings.easing); }
  if (is.arr(prop)) {
    var l = prop.length;
    var isFromTo = (l === 2 && !is.obj(prop[0]));
    if (!isFromTo) {
      // Duration divided by the number of tweens
      if (!is.fnc(tweenSettings.duration)) { settings.duration = tweenSettings.duration / l; }
    } else {
      // Transform [from, to] values shorthand to a valid tween value
      prop = {value: prop};
    }
  }
  var propArray = is.arr(prop) ? prop : [prop];
  return propArray.map(function (v, i) {
    var obj = (is.obj(v) && !is.pth(v)) ? v : {value: v};
    // Default delay value should only be applied to the first tween
    if (is.und(obj.delay)) { obj.delay = !i ? tweenSettings.delay : 0; }
    // Default endDelay value should only be applied to the last tween
    if (is.und(obj.endDelay)) { obj.endDelay = i === propArray.length - 1 ? tweenSettings.endDelay : 0; }
    return obj;
  }).map(function (k) { return mergeObjects(k, settings); });
}


function flattenKeyframes(keyframes) {
  var propertyNames = filterArray(flattenArray(keyframes.map(function (key) { return Object.keys(key); })), function (p) { return is.key(p); })
  .reduce(function (a,b) { if (a.indexOf(b) < 0) { a.push(b); } return a; }, []);
  var properties = {};
  var loop = function ( i ) {
    var propName = propertyNames[i];
    properties[propName] = keyframes.map(function (key) {
      var newKey = {};
      for (var p in key) {
        if (is.key(p)) {
          if (p == propName) { newKey.value = key[p]; }
        } else {
          newKey[p] = key[p];
        }
      }
      return newKey;
    });
  };

  for (var i = 0; i < propertyNames.length; i++) loop( i );
  return properties;
}

function getProperties(tweenSettings, params) {
  var properties = [];
  var keyframes = params.keyframes;
  if (keyframes) { params = mergeObjects(flattenKeyframes(keyframes), params); }
  for (var p in params) {
    if (is.key(p)) {
      properties.push({
        name: p,
        tweens: normalizePropertyTweens(params[p], tweenSettings)
      });
    }
  }
  return properties;
}

// Tweens

function normalizeTweenValues(tween, animatable) {
  var t = {};
  for (var p in tween) {
    var value = getFunctionValue(tween[p], animatable);
    if (is.arr(value)) {
      value = value.map(function (v) { return getFunctionValue(v, animatable); });
      if (value.length === 1) { value = value[0]; }
    }
    t[p] = value;
  }
  t.duration = parseFloat(t.duration);
  t.delay = parseFloat(t.delay);
  return t;
}

function normalizeTweens(prop, animatable) {
  var previousTween;
  return prop.tweens.map(function (t) {
    var tween = normalizeTweenValues(t, animatable);
    var tweenValue = tween.value;
    var to = is.arr(tweenValue) ? tweenValue[1] : tweenValue;
    var toUnit = getUnit(to);
    var originalValue = getOriginalTargetValue(animatable.target, prop.name, toUnit, animatable);
    var previousValue = previousTween ? previousTween.to.original : originalValue;
    var from = is.arr(tweenValue) ? tweenValue[0] : previousValue;
    var fromUnit = getUnit(from) || getUnit(originalValue);
    var unit = toUnit || fromUnit;
    if (is.und(to)) { to = previousValue; }
    tween.from = decomposeValue(from, unit);
    tween.to = decomposeValue(getRelativeValue(to, from), unit);
    tween.start = previousTween ? previousTween.end : 0;
    tween.end = tween.start + tween.delay + tween.duration + tween.endDelay;
    tween.easing = parseEasings(tween.easing, tween.duration);
    tween.isPath = is.pth(tweenValue);
    tween.isColor = is.col(tween.from.original);
    if (tween.isColor) { tween.round = 1; }
    previousTween = tween;
    return tween;
  });
}

// Tween progress

var setProgressValue = {
  css: function (t, p, v) { return t.style[p] = v; },
  attribute: function (t, p, v) { return t.setAttribute(p, v); },
  object: function (t, p, v) { return t[p] = v; },
  transform: function (t, p, v, transforms, manual) {
    transforms.list.set(p, v);
    if (p === transforms.last || manual) {
      var str = '';
      transforms.list.forEach(function (value, prop) { str += prop + "(" + value + ") "; });
      t.style.transform = str;
    }
  }
};

// Set Value helper

function setTargetsValue(targets, properties) {
  var animatables = getAnimatables(targets);
  animatables.forEach(function (animatable) {
    for (var property in properties) {
      var value = getFunctionValue(properties[property], animatable);
      var target = animatable.target;
      var valueUnit = getUnit(value);
      var originalValue = getOriginalTargetValue(target, property, valueUnit, animatable);
      var unit = valueUnit || getUnit(originalValue);
      var to = getRelativeValue(validateValue(value, unit), originalValue);
      var animType = getAnimationType(target, property);
      setProgressValue[animType](target, property, to, animatable.transforms, true);
    }
  });
}

// Animations

function createAnimation(animatable, prop) {
  var animType = getAnimationType(animatable.target, prop.name);
  if (animType) {
    var tweens = normalizeTweens(prop, animatable);
    var lastTween = tweens[tweens.length - 1];
    return {
      type: animType,
      property: prop.name,
      animatable: animatable,
      tweens: tweens,
      duration: lastTween.end,
      delay: tweens[0].delay,
      endDelay: lastTween.endDelay
    }
  }
}

function getAnimations(animatables, properties) {
  return filterArray(flattenArray(animatables.map(function (animatable) {
    return properties.map(function (prop) {
      return createAnimation(animatable, prop);
    });
  })), function (a) { return !is.und(a); });
}

// Create Instance

function getInstanceTimings(animations, tweenSettings) {
  var animLength = animations.length;
  var getTlOffset = function (anim) { return anim.timelineOffset ? anim.timelineOffset : 0; };
  var timings = {};
  timings.duration = animLength ? Math.max.apply(Math, animations.map(function (anim) { return getTlOffset(anim) + anim.duration; })) : tweenSettings.duration;
  timings.delay = animLength ? Math.min.apply(Math, animations.map(function (anim) { return getTlOffset(anim) + anim.delay; })) : tweenSettings.delay;
  timings.endDelay = animLength ? timings.duration - Math.max.apply(Math, animations.map(function (anim) { return getTlOffset(anim) + anim.duration - anim.endDelay; })) : tweenSettings.endDelay;
  return timings;
}

var instanceID = 0;

function createNewInstance(params) {
  var instanceSettings = replaceObjectProps(defaultInstanceSettings, params);
  var tweenSettings = replaceObjectProps(defaultTweenSettings, params);
  var properties = getProperties(tweenSettings, params);
  var animatables = getAnimatables(params.targets);
  var animations = getAnimations(animatables, properties);
  var timings = getInstanceTimings(animations, tweenSettings);
  var id = instanceID;
  instanceID++;
  return mergeObjects(instanceSettings, {
    id: id,
    children: [],
    animatables: animatables,
    animations: animations,
    duration: timings.duration,
    delay: timings.delay,
    endDelay: timings.endDelay
  });
}

// Core

var activeInstances = [];
var pausedInstances = [];
var raf;

var engine = (function () {
  function play() { 
    raf = requestAnimationFrame(step);
  }
  function step(t) {
    var activeInstancesLength = activeInstances.length;
    if (activeInstancesLength) {
      var i = 0;
      while (i < activeInstancesLength) {
        var activeInstance = activeInstances[i];
        if (!activeInstance.paused) {
          activeInstance.tick(t);
        } else {
          var instanceIndex = activeInstances.indexOf(activeInstance);
          if (instanceIndex > -1) {
            activeInstances.splice(instanceIndex, 1);
            activeInstancesLength = activeInstances.length;
          }
        }
        i++;
      }
      play();
    } else {
      raf = cancelAnimationFrame(raf);
    }
  }
  return play;
})();

function handleVisibilityChange() {
  if (document.hidden) {
    activeInstances.forEach(function (ins) { return ins.pause(); });
    pausedInstances = activeInstances.slice(0);
    activeInstances = [];
  } else {
    pausedInstances.forEach(function (ins) { return ins.play(); });
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

// Public Instance

function anime(params) {
  if ( params === void 0 ) params = {};


  var startTime = 0, lastTime = 0, now = 0;
  var children, childrenLength = 0;
  var resolve = null;

  function makePromise(instance) {
    var promise = window.Promise && new Promise(function (_resolve) { return resolve = _resolve; });
    instance.finished = promise;
    return promise;
  }

  var instance = createNewInstance(params);
  var promise = makePromise(instance);

  function toggleInstanceDirection() {
    var direction = instance.direction;
    if (direction !== 'alternate') {
      instance.direction = direction !== 'normal' ? 'normal' : 'reverse';
    }
    instance.reversed = !instance.reversed;
    children.forEach(function (child) { return child.reversed = instance.reversed; });
  }

  function adjustTime(time) {
    return instance.reversed ? instance.duration - time : time;
  }

  function resetTime() {
    startTime = 0;
    lastTime = adjustTime(instance.currentTime) * (1 / anime.speed);
  }

  function seekCild(time, child) {
    if (child) { child.seek(time - child.timelineOffset); }
  }

  function syncInstanceChildren(time) {
    if (!instance.reversePlayback) {
      for (var i = 0; i < childrenLength; i++) { seekCild(time, children[i]); }
    } else {
      for (var i$1 = childrenLength; i$1--;) { seekCild(time, children[i$1]); }
    }
  }

  function setAnimationsProgress(insTime) {
    var i = 0;
    var animations = instance.animations;
    var animationsLength = animations.length;
    while (i < animationsLength) {
      var anim = animations[i];
      var animatable = anim.animatable;
      var tweens = anim.tweens;
      var tweenLength = tweens.length - 1;
      var tween = tweens[tweenLength];
      // Only check for keyframes if there is more than one tween
      if (tweenLength) { tween = filterArray(tweens, function (t) { return (insTime < t.end); })[0] || tween; }
      var elapsed = minMax(insTime - tween.start - tween.delay, 0, tween.duration) / tween.duration;
      var eased = isNaN(elapsed) ? 1 : tween.easing(elapsed);
      var strings = tween.to.strings;
      var round = tween.round;
      var numbers = [];
      var toNumbersLength = tween.to.numbers.length;
      var progress = (void 0);
      for (var n = 0; n < toNumbersLength; n++) {
        var value = (void 0);
        var toNumber = tween.to.numbers[n];
        var fromNumber = tween.from.numbers[n] || 0;
        if (!tween.isPath) {
          value = fromNumber + (eased * (toNumber - fromNumber));
        } else {
          value = getPathProgress(tween.value, eased * toNumber);
        }
        if (round) {
          if (!(tween.isColor && n > 2)) {
            value = Math.round(value * round) / round;
          }
        }
        numbers.push(value);
      }
      // Manual Array.reduce for better performances
      var stringsLength = strings.length;
      if (!stringsLength) {
        progress = numbers[0];
      } else {
        progress = strings[0];
        for (var s = 0; s < stringsLength; s++) {
          var a = strings[s];
          var b = strings[s + 1];
          var n$1 = numbers[s];
          if (!isNaN(n$1)) {
            if (!b) {
              progress += n$1 + ' ';
            } else {
              progress += n$1 + b;
            }
          }
        }
      }
      setProgressValue[anim.type](animatable.target, anim.property, progress, animatable.transforms);
      anim.currentValue = progress;
      i++;
    }
  }

  function setCallback(cb) {
    if (instance[cb] && !instance.passThrough) { instance[cb](instance); }
  }

  function countIteration() {
    if (instance.remaining && instance.remaining !== true) {
      instance.remaining--;
    }
  }

  function setInstanceProgress(engineTime) {
    var insDuration = instance.duration;
    var insDelay = instance.delay;
    var insEndDelay = insDuration - instance.endDelay;
    var insTime = adjustTime(engineTime);
    instance.progress = minMax((insTime / insDuration) * 100, 0, 100);
    instance.reversePlayback = insTime < instance.currentTime;
    if (children) { syncInstanceChildren(insTime); }
    if (!instance.began && instance.currentTime > 0) {
      instance.began = true;
      setCallback('begin');
      setCallback('loopBegin');
    }
    if (insTime <= insDelay && instance.currentTime !== 0) {
      setAnimationsProgress(0);
    }
    if ((insTime >= insEndDelay && instance.currentTime !== insDuration) || !insDuration) {
      setAnimationsProgress(insDuration);
    }
    if (insTime > insDelay && insTime < insEndDelay) {
      if (!instance.changeBegan) {
        instance.changeBegan = true;
        instance.changeCompleted = false;
        setCallback('changeBegin');
      }
      setCallback('change');
      setAnimationsProgress(insTime);
    } else {
      if (instance.changeBegan) {
        instance.changeCompleted = true;
        instance.changeBegan = false;
        setCallback('changeComplete');
      }
    }
    instance.currentTime = minMax(insTime, 0, insDuration);
    if (instance.began) { setCallback('update'); }
    if (engineTime >= insDuration) {
      lastTime = 0;
      countIteration();
      if (instance.remaining) {
        startTime = now;
        setCallback('loopComplete');
        setCallback('loopBegin');
        if (instance.direction === 'alternate') { toggleInstanceDirection(); }
      } else {
        instance.paused = true;
        if (!instance.completed) {
          instance.completed = true;
          setCallback('loopComplete');
          setCallback('complete');
          if (!instance.passThrough && 'Promise' in window) {
            resolve();
            promise = makePromise(instance);
          }
        }
      }
    }
  }

  instance.reset = function() {
    var direction = instance.direction;
    instance.passThrough = false;
    instance.currentTime = 0;
    instance.progress = 0;
    instance.paused = true;
    instance.began = false;
    instance.changeBegan = false;
    instance.completed = false;
    instance.changeCompleted = false;
    instance.reversePlayback = false;
    instance.reversed = direction === 'reverse';
    instance.remaining = instance.loop;
    children = instance.children;
    childrenLength = children.length;
    for (var i = childrenLength; i--;) { instance.children[i].reset(); }
    if (instance.reversed && instance.loop !== true || (direction === 'alternate' && instance.loop === 1)) { instance.remaining++; }
    setAnimationsProgress(0);
  };

  // Set Value helper

  instance.set = function(targets, properties) {
    setTargetsValue(targets, properties);
    return instance;
  };

  instance.tick = function(t) {
    now = t;
    if (!startTime) { startTime = now; }
    setInstanceProgress((now + (lastTime - startTime)) * anime.speed);
  };

  instance.seek = function(time) {
    setInstanceProgress(adjustTime(time));
  };

  instance.pause = function() {
    instance.paused = true;
    resetTime();
  };

  instance.play = function() {
    if (!instance.paused) { return; }
    if (instance.completed) { instance.reset(); }
    instance.paused = false;
    activeInstances.push(instance);
    resetTime();
    if (!raf) { engine(); }
  };

  instance.reverse = function() {
    toggleInstanceDirection();
    resetTime();
  };

  instance.restart = function() {
    instance.reset();
    instance.play();
  };

  instance.reset();

  if (instance.autoplay) { instance.play(); }

  return instance;

}

// Remove targets from animation

function removeTargetsFromAnimations(targetsArray, animations) {
  for (var a = animations.length; a--;) {
    if (arrayContains(targetsArray, animations[a].animatable.target)) {
      animations.splice(a, 1);
    }
  }
}

function removeTargets(targets) {
  var targetsArray = parseTargets(targets);
  for (var i = activeInstances.length; i--;) {
    var instance = activeInstances[i];
    var animations = instance.animations;
    var children = instance.children;
    removeTargetsFromAnimations(targetsArray, animations);
    for (var c = children.length; c--;) {
      var child = children[c];
      var childAnimations = child.animations;
      removeTargetsFromAnimations(targetsArray, childAnimations);
      if (!childAnimations.length && !child.children.length) { children.splice(c, 1); }
    }
    if (!animations.length && !children.length) { instance.pause(); }
  }
}

// Stagger helpers

function stagger(val, params) {
  if ( params === void 0 ) params = {};

  var direction = params.direction || 'normal';
  var easing = params.easing ? parseEasings(params.easing) : null;
  var grid = params.grid;
  var axis = params.axis;
  var fromIndex = params.from || 0;
  var fromFirst = fromIndex === 'first';
  var fromCenter = fromIndex === 'center';
  var fromLast = fromIndex === 'last';
  var isRange = is.arr(val);
  var val1 = isRange ? parseFloat(val[0]) : parseFloat(val);
  var val2 = isRange ? parseFloat(val[1]) : 0;
  var unit = getUnit(isRange ? val[1] : val) || 0;
  var start = params.start || 0 + (isRange ? val1 : 0);
  var values = [];
  var maxValue = 0;
  return function (el, i, t) {
    if (fromFirst) { fromIndex = 0; }
    if (fromCenter) { fromIndex = (t - 1) / 2; }
    if (fromLast) { fromIndex = t - 1; }
    if (!values.length) {
      for (var index = 0; index < t; index++) {
        if (!grid) {
          values.push(Math.abs(fromIndex - index));
        } else {
          var fromX = !fromCenter ? fromIndex%grid[0] : (grid[0]-1)/2;
          var fromY = !fromCenter ? Math.floor(fromIndex/grid[0]) : (grid[1]-1)/2;
          var toX = index%grid[0];
          var toY = Math.floor(index/grid[0]);
          var distanceX = fromX - toX;
          var distanceY = fromY - toY;
          var value = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
          if (axis === 'x') { value = -distanceX; }
          if (axis === 'y') { value = -distanceY; }
          values.push(value);
        }
        maxValue = Math.max.apply(Math, values);
      }
      if (easing) { values = values.map(function (val) { return easing(val / maxValue) * maxValue; }); }
      if (direction === 'reverse') { values = values.map(function (val) { return axis ? (val < 0) ? val * -1 : -val : Math.abs(maxValue - val); }); }
    }
    var spacing = isRange ? (val2 - val1) / maxValue : val1;
    return start + (spacing * (Math.round(values[i] * 100) / 100)) + unit;
  }
}

// Timeline

function timeline(params) {
  if ( params === void 0 ) params = {};

  var tl = anime(params);
  tl.duration = 0;
  tl.add = function(instanceParams, timelineOffset) {
    var tlIndex = activeInstances.indexOf(tl);
    var children = tl.children;
    if (tlIndex > -1) { activeInstances.splice(tlIndex, 1); }
    function passThrough(ins) { ins.passThrough = true; }
    for (var i = 0; i < children.length; i++) { passThrough(children[i]); }
    var insParams = mergeObjects(instanceParams, replaceObjectProps(defaultTweenSettings, params));
    insParams.targets = insParams.targets || params.targets;
    var tlDuration = tl.duration;
    insParams.autoplay = false;
    insParams.direction = tl.direction;
    insParams.timelineOffset = is.und(timelineOffset) ? tlDuration : getRelativeValue(timelineOffset, tlDuration);
    passThrough(tl);
    tl.seek(insParams.timelineOffset);
    var ins = anime(insParams);
    passThrough(ins);
    children.push(ins);
    var timings = getInstanceTimings(children, params);
    tl.delay = timings.delay;
    tl.endDelay = timings.endDelay;
    tl.duration = timings.duration;
    tl.seek(0);
    tl.reset();
    if (tl.autoplay) { tl.play(); }
    return tl;
  };
  return tl;
}

anime.version = '3.0.1';
anime.speed = 1;
anime.running = activeInstances;
anime.remove = removeTargets;
anime.get = getOriginalTargetValue;
anime.set = setTargetsValue;
anime.convertPx = convertPxToUnit;
anime.path = getPath;
anime.setDashoffset = setDashoffset;
anime.stagger = stagger;
anime.timeline = timeline;
anime.easing = parseEasings;
anime.penner = penner;
anime.random = function (min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; };

module.exports = anime;

},{}],6:[function(require,module,exports){
(function (Buffer){
var clone = (function() {
'use strict';

/**
 * Clones (copies) an Object using deep copying.
 *
 * This function supports circular references by default, but if you are certain
 * there are no circular references in your object, you can save some CPU time
 * by calling clone(obj, false).
 *
 * Caution: if `circular` is false and `parent` contains circular references,
 * your program may enter an infinite loop and crash.
 *
 * @param `parent` - the object to be cloned
 * @param `circular` - set to true if the object to be cloned may contain
 *    circular references. (optional - true by default)
 * @param `depth` - set to a number if the object is only to be cloned to
 *    a particular depth. (optional - defaults to Infinity)
 * @param `prototype` - sets the prototype to be used when cloning an object.
 *    (optional - defaults to parent prototype).
*/
function clone(parent, circular, depth, prototype) {
  var filter;
  if (typeof circular === 'object') {
    depth = circular.depth;
    prototype = circular.prototype;
    filter = circular.filter;
    circular = circular.circular
  }
  // maintain two arrays for circular references, where corresponding parents
  // and children have the same index
  var allParents = [];
  var allChildren = [];

  var useBuffer = typeof Buffer != 'undefined';

  if (typeof circular == 'undefined')
    circular = true;

  if (typeof depth == 'undefined')
    depth = Infinity;

  // recurse this function so we don't reset allParents and allChildren
  function _clone(parent, depth) {
    // cloning null always returns null
    if (parent === null)
      return null;

    if (depth == 0)
      return parent;

    var child;
    var proto;
    if (typeof parent != 'object') {
      return parent;
    }

    if (clone.__isArray(parent)) {
      child = [];
    } else if (clone.__isRegExp(parent)) {
      child = new RegExp(parent.source, __getRegExpFlags(parent));
      if (parent.lastIndex) child.lastIndex = parent.lastIndex;
    } else if (clone.__isDate(parent)) {
      child = new Date(parent.getTime());
    } else if (useBuffer && Buffer.isBuffer(parent)) {
      if (Buffer.allocUnsafe) {
        // Node.js >= 4.5.0
        child = Buffer.allocUnsafe(parent.length);
      } else {
        // Older Node.js versions
        child = new Buffer(parent.length);
      }
      parent.copy(child);
      return child;
    } else {
      if (typeof prototype == 'undefined') {
        proto = Object.getPrototypeOf(parent);
        child = Object.create(proto);
      }
      else {
        child = Object.create(prototype);
        proto = prototype;
      }
    }

    if (circular) {
      var index = allParents.indexOf(parent);

      if (index != -1) {
        return allChildren[index];
      }
      allParents.push(parent);
      allChildren.push(child);
    }

    for (var i in parent) {
      var attrs;
      if (proto) {
        attrs = Object.getOwnPropertyDescriptor(proto, i);
      }

      if (attrs && attrs.set == null) {
        continue;
      }
      child[i] = _clone(parent[i], depth - 1);
    }

    return child;
  }

  return _clone(parent, depth);
}

/**
 * Simple flat clone using prototype, accepts only objects, usefull for property
 * override on FLAT configuration object (no nested props).
 *
 * USE WITH CAUTION! This may not behave as you wish if you do not know how this
 * works.
 */
clone.clonePrototype = function clonePrototype(parent) {
  if (parent === null)
    return null;

  var c = function () {};
  c.prototype = parent;
  return new c();
};

// private utility functions

function __objToStr(o) {
  return Object.prototype.toString.call(o);
};
clone.__objToStr = __objToStr;

function __isDate(o) {
  return typeof o === 'object' && __objToStr(o) === '[object Date]';
};
clone.__isDate = __isDate;

function __isArray(o) {
  return typeof o === 'object' && __objToStr(o) === '[object Array]';
};
clone.__isArray = __isArray;

function __isRegExp(o) {
  return typeof o === 'object' && __objToStr(o) === '[object RegExp]';
};
clone.__isRegExp = __isRegExp;

function __getRegExpFlags(re) {
  var flags = '';
  if (re.global) flags += 'g';
  if (re.ignoreCase) flags += 'i';
  if (re.multiline) flags += 'm';
  return flags;
};
clone.__getRegExpFlags = __getRegExpFlags;

return clone;
})();

if (typeof module === 'object' && module.exports) {
  module.exports = clone;
}

}).call(this,require("buffer").Buffer)
},{"buffer":2}],7:[function(require,module,exports){
var DOCUMENT_POSITION_CONTAINED_BY = 16

module.exports = contains

function contains(container, elem) {
    if (container.contains) {
        return container.contains(elem)
    }

    var comparison = container.compareDocumentPosition(elem)

    return comparison === 0 || comparison & DOCUMENT_POSITION_CONTAINED_BY
}

},{}],8:[function(require,module,exports){
/*!
 * escape-html
 * Copyright(c) 2012-2013 TJ Holowaychuk
 * Copyright(c) 2015 Andreas Lubbe
 * Copyright(c) 2015 Tiancheng "Timothy" Gu
 * MIT Licensed
 */

'use strict';

/**
 * Module variables.
 * @private
 */

var matchHtmlRegExp = /["'&<>]/;

/**
 * Module exports.
 * @public
 */

module.exports = escapeHtml;

/**
 * Escape special characters in the given string of html.
 *
 * @param  {string} string The string to escape for inserting into HTML
 * @return {string}
 * @public
 */

function escapeHtml(string) {
  var str = '' + string;
  var match = matchHtmlRegExp.exec(str);

  if (!match) {
    return str;
  }

  var escape;
  var html = '';
  var index = 0;
  var lastIndex = 0;

  for (index = match.index; index < str.length; index++) {
    switch (str.charCodeAt(index)) {
      case 34: // "
        escape = '&quot;';
        break;
      case 38: // &
        escape = '&amp;';
        break;
      case 39: // '
        escape = '&#39;';
        break;
      case 60: // <
        escape = '&lt;';
        break;
      case 62: // >
        escape = '&gt;';
        break;
      default:
        continue;
    }

    if (lastIndex !== index) {
      html += str.substring(lastIndex, index);
    }

    lastIndex = index + 1;
    html += escape;
  }

  return lastIndex !== index
    ? html + str.substring(lastIndex, index)
    : html;
}

},{}],9:[function(require,module,exports){
'use strict'

var hasOwn = Object.prototype.hasOwnProperty

function curry(fn, n){

    if (typeof n !== 'number'){
        n = fn.length
    }

    function getCurryClosure(prevArgs){

        function curryClosure() {

            var len  = arguments.length
            var args = [].concat(prevArgs)

            if (len){
                args.push.apply(args, arguments)
            }

            if (args.length < n){
                return getCurryClosure(args)
            }

            return fn.apply(this, args)
        }

        return curryClosure
    }

    return getCurryClosure([])
}


module.exports = curry(function(object, property){
    return hasOwn.call(object, property)
})
},{}],10:[function(require,module,exports){
var root = require('./_root');

/** Built-in value references. */
var Symbol = root.Symbol;

module.exports = Symbol;

},{"./_root":18}],11:[function(require,module,exports){
var Symbol = require('./_Symbol'),
    getRawTag = require('./_getRawTag'),
    objectToString = require('./_objectToString');

/** `Object#toString` result references. */
var nullTag = '[object Null]',
    undefinedTag = '[object Undefined]';

/** Built-in value references. */
var symToStringTag = Symbol ? Symbol.toStringTag : undefined;

/**
 * The base implementation of `getTag` without fallbacks for buggy environments.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
function baseGetTag(value) {
  if (value == null) {
    return value === undefined ? undefinedTag : nullTag;
  }
  return (symToStringTag && symToStringTag in Object(value))
    ? getRawTag(value)
    : objectToString(value);
}

module.exports = baseGetTag;

},{"./_Symbol":10,"./_getRawTag":14,"./_objectToString":17}],12:[function(require,module,exports){
/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeFloor = Math.floor,
    nativeRandom = Math.random;

/**
 * The base implementation of `_.random` without support for returning
 * floating-point numbers.
 *
 * @private
 * @param {number} lower The lower bound.
 * @param {number} upper The upper bound.
 * @returns {number} Returns the random number.
 */
function baseRandom(lower, upper) {
  return lower + nativeFloor(nativeRandom() * (upper - lower + 1));
}

module.exports = baseRandom;

},{}],13:[function(require,module,exports){
(function (global){
/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

module.exports = freeGlobal;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],14:[function(require,module,exports){
var Symbol = require('./_Symbol');

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString = objectProto.toString;

/** Built-in value references. */
var symToStringTag = Symbol ? Symbol.toStringTag : undefined;

/**
 * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the raw `toStringTag`.
 */
function getRawTag(value) {
  var isOwn = hasOwnProperty.call(value, symToStringTag),
      tag = value[symToStringTag];

  try {
    value[symToStringTag] = undefined;
    var unmasked = true;
  } catch (e) {}

  var result = nativeObjectToString.call(value);
  if (unmasked) {
    if (isOwn) {
      value[symToStringTag] = tag;
    } else {
      delete value[symToStringTag];
    }
  }
  return result;
}

module.exports = getRawTag;

},{"./_Symbol":10}],15:[function(require,module,exports){
/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  var type = typeof value;
  length = length == null ? MAX_SAFE_INTEGER : length;

  return !!length &&
    (type == 'number' ||
      (type != 'symbol' && reIsUint.test(value))) &&
        (value > -1 && value % 1 == 0 && value < length);
}

module.exports = isIndex;

},{}],16:[function(require,module,exports){
var eq = require('./eq'),
    isArrayLike = require('./isArrayLike'),
    isIndex = require('./_isIndex'),
    isObject = require('./isObject');

/**
 * Checks if the given arguments are from an iteratee call.
 *
 * @private
 * @param {*} value The potential iteratee value argument.
 * @param {*} index The potential iteratee index or key argument.
 * @param {*} object The potential iteratee object argument.
 * @returns {boolean} Returns `true` if the arguments are from an iteratee call,
 *  else `false`.
 */
function isIterateeCall(value, index, object) {
  if (!isObject(object)) {
    return false;
  }
  var type = typeof index;
  if (type == 'number'
        ? (isArrayLike(object) && isIndex(index, object.length))
        : (type == 'string' && index in object)
      ) {
    return eq(object[index], value);
  }
  return false;
}

module.exports = isIterateeCall;

},{"./_isIndex":15,"./eq":19,"./isArrayLike":20,"./isObject":23}],17:[function(require,module,exports){
/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString = objectProto.toString;

/**
 * Converts `value` to a string using `Object.prototype.toString`.
 *
 * @private
 * @param {*} value The value to convert.
 * @returns {string} Returns the converted string.
 */
function objectToString(value) {
  return nativeObjectToString.call(value);
}

module.exports = objectToString;

},{}],18:[function(require,module,exports){
var freeGlobal = require('./_freeGlobal');

/** Detect free variable `self`. */
var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

/** Used as a reference to the global object. */
var root = freeGlobal || freeSelf || Function('return this')();

module.exports = root;

},{"./_freeGlobal":13}],19:[function(require,module,exports){
/**
 * Performs a
 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

module.exports = eq;

},{}],20:[function(require,module,exports){
var isFunction = require('./isFunction'),
    isLength = require('./isLength');

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null && isLength(value.length) && !isFunction(value);
}

module.exports = isArrayLike;

},{"./isFunction":21,"./isLength":22}],21:[function(require,module,exports){
var baseGetTag = require('./_baseGetTag'),
    isObject = require('./isObject');

/** `Object#toString` result references. */
var asyncTag = '[object AsyncFunction]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    proxyTag = '[object Proxy]';

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  if (!isObject(value)) {
    return false;
  }
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 9 which returns 'object' for typed arrays and other constructors.
  var tag = baseGetTag(value);
  return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
}

module.exports = isFunction;

},{"./_baseGetTag":11,"./isObject":23}],22:[function(require,module,exports){
/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This method is loosely based on
 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

module.exports = isLength;

},{}],23:[function(require,module,exports){
/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return value != null && (type == 'object' || type == 'function');
}

module.exports = isObject;

},{}],24:[function(require,module,exports){
/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return value != null && typeof value == 'object';
}

module.exports = isObjectLike;

},{}],25:[function(require,module,exports){
var baseGetTag = require('./_baseGetTag'),
    isObjectLike = require('./isObjectLike');

/** `Object#toString` result references. */
var symbolTag = '[object Symbol]';

/**
 * Checks if `value` is classified as a `Symbol` primitive or object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
 * @example
 *
 * _.isSymbol(Symbol.iterator);
 * // => true
 *
 * _.isSymbol('abc');
 * // => false
 */
function isSymbol(value) {
  return typeof value == 'symbol' ||
    (isObjectLike(value) && baseGetTag(value) == symbolTag);
}

module.exports = isSymbol;

},{"./_baseGetTag":11,"./isObjectLike":24}],26:[function(require,module,exports){
var baseRandom = require('./_baseRandom'),
    isIterateeCall = require('./_isIterateeCall'),
    toFinite = require('./toFinite');

/** Built-in method references without a dependency on `root`. */
var freeParseFloat = parseFloat;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeMin = Math.min,
    nativeRandom = Math.random;

/**
 * Produces a random number between the inclusive `lower` and `upper` bounds.
 * If only one argument is provided a number between `0` and the given number
 * is returned. If `floating` is `true`, or either `lower` or `upper` are
 * floats, a floating-point number is returned instead of an integer.
 *
 * **Note:** JavaScript follows the IEEE-754 standard for resolving
 * floating-point values which can produce unexpected results.
 *
 * @static
 * @memberOf _
 * @since 0.7.0
 * @category Number
 * @param {number} [lower=0] The lower bound.
 * @param {number} [upper=1] The upper bound.
 * @param {boolean} [floating] Specify returning a floating-point number.
 * @returns {number} Returns the random number.
 * @example
 *
 * _.random(0, 5);
 * // => an integer between 0 and 5
 *
 * _.random(5);
 * // => also an integer between 0 and 5
 *
 * _.random(5, true);
 * // => a floating-point number between 0 and 5
 *
 * _.random(1.2, 5.2);
 * // => a floating-point number between 1.2 and 5.2
 */
function random(lower, upper, floating) {
  if (floating && typeof floating != 'boolean' && isIterateeCall(lower, upper, floating)) {
    upper = floating = undefined;
  }
  if (floating === undefined) {
    if (typeof upper == 'boolean') {
      floating = upper;
      upper = undefined;
    }
    else if (typeof lower == 'boolean') {
      floating = lower;
      lower = undefined;
    }
  }
  if (lower === undefined && upper === undefined) {
    lower = 0;
    upper = 1;
  }
  else {
    lower = toFinite(lower);
    if (upper === undefined) {
      upper = lower;
      lower = 0;
    } else {
      upper = toFinite(upper);
    }
  }
  if (lower > upper) {
    var temp = lower;
    lower = upper;
    upper = temp;
  }
  if (floating || lower % 1 || upper % 1) {
    var rand = nativeRandom();
    return nativeMin(lower + (rand * (upper - lower + freeParseFloat('1e-' + ((rand + '').length - 1)))), upper);
  }
  return baseRandom(lower, upper);
}

module.exports = random;

},{"./_baseRandom":12,"./_isIterateeCall":16,"./toFinite":27}],27:[function(require,module,exports){
var toNumber = require('./toNumber');

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0,
    MAX_INTEGER = 1.7976931348623157e+308;

/**
 * Converts `value` to a finite number.
 *
 * @static
 * @memberOf _
 * @since 4.12.0
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {number} Returns the converted number.
 * @example
 *
 * _.toFinite(3.2);
 * // => 3.2
 *
 * _.toFinite(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toFinite(Infinity);
 * // => 1.7976931348623157e+308
 *
 * _.toFinite('3.2');
 * // => 3.2
 */
function toFinite(value) {
  if (!value) {
    return value === 0 ? value : 0;
  }
  value = toNumber(value);
  if (value === INFINITY || value === -INFINITY) {
    var sign = (value < 0 ? -1 : 1);
    return sign * MAX_INTEGER;
  }
  return value === value ? value : 0;
}

module.exports = toFinite;

},{"./toNumber":28}],28:[function(require,module,exports){
var isObject = require('./isObject'),
    isSymbol = require('./isSymbol');

/** Used as references for various `Number` constants. */
var NAN = 0 / 0;

/** Used to match leading and trailing whitespace. */
var reTrim = /^\s+|\s+$/g;

/** Used to detect bad signed hexadecimal string values. */
var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

/** Used to detect binary string values. */
var reIsBinary = /^0b[01]+$/i;

/** Used to detect octal string values. */
var reIsOctal = /^0o[0-7]+$/i;

/** Built-in method references without a dependency on `root`. */
var freeParseInt = parseInt;

/**
 * Converts `value` to a number.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to process.
 * @returns {number} Returns the number.
 * @example
 *
 * _.toNumber(3.2);
 * // => 3.2
 *
 * _.toNumber(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toNumber(Infinity);
 * // => Infinity
 *
 * _.toNumber('3.2');
 * // => 3.2
 */
function toNumber(value) {
  if (typeof value == 'number') {
    return value;
  }
  if (isSymbol(value)) {
    return NAN;
  }
  if (isObject(value)) {
    var other = typeof value.valueOf == 'function' ? value.valueOf() : value;
    value = isObject(other) ? (other + '') : other;
  }
  if (typeof value != 'string') {
    return value === 0 ? value : +value;
  }
  value = value.replace(reTrim, '');
  var isBinary = reIsBinary.test(value);
  return (isBinary || reIsOctal.test(value))
    ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
    : (reIsBadHex.test(value) ? NAN : +value);
}

module.exports = toNumber;

},{"./isObject":23,"./isSymbol":25}],29:[function(require,module,exports){
'use strict';

var proto = typeof Element !== 'undefined' ? Element.prototype : {};
var vendor = proto.matches
  || proto.matchesSelector
  || proto.webkitMatchesSelector
  || proto.mozMatchesSelector
  || proto.msMatchesSelector
  || proto.oMatchesSelector;

module.exports = match;

/**
 * Match `el` to `selector`.
 *
 * @param {Element} el
 * @param {String} selector
 * @return {Boolean}
 * @api public
 */

function match(el, selector) {
  if (!el || el.nodeType !== 1) return false;
  if (vendor) return vendor.call(el, selector);
  var nodes = el.parentNode.querySelectorAll(selector);
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i] == el) return true;
  }
  return false;
}

},{}],30:[function(require,module,exports){
module.exports = function(){

    'use strict';

    var fns = {}

    return function(len){

        if ( ! fns [len ] ) {

            var args = []
            var i    = 0

            for (; i < len; i++ ) {
                args.push( 'a[' + i + ']')
            }

            fns[len] = new Function(
                            'c',
                            'a',
                            'return new c(' + args.join(',') + ')'
                        )
        }

        return fns[len]
    }

}()
},{}],31:[function(require,module,exports){
var getInstantiatorFunction = require('./getInstantiatorFunction')

module.exports = function(fn, args){
	return getInstantiatorFunction(args.length)(fn, args)
}
},{"./getInstantiatorFunction":30}],32:[function(require,module,exports){
'use strict';
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function ToObject(val) {
	if (val == null) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

function ownEnumerableKeys(obj) {
	var keys = Object.getOwnPropertyNames(obj);

	if (Object.getOwnPropertySymbols) {
		keys = keys.concat(Object.getOwnPropertySymbols(obj));
	}

	return keys.filter(function (key) {
		return propIsEnumerable.call(obj, key);
	});
}

module.exports = Object.assign || function (target, source) {
	var from;
	var keys;
	var to = ToObject(target);

	for (var s = 1; s < arguments.length; s++) {
		from = arguments[s];
		keys = ownEnumerableKeys(Object(from));

		for (var i = 0; i < keys.length; i++) {
			to[keys[i]] = from[keys[i]];
		}
	}

	return to;
};

},{}],33:[function(require,module,exports){
(function (global){
'use strict';

var el

module.exports = function(){

	if(!el && !!global.document){
	  	el = global.document.createElement('div')
	}

	if (!el){
		el = {style: {}}
	}

	return el
}
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],34:[function(require,module,exports){
'use strict';

var toUpperFirst = require('./toUpperFirst')
var getPrefix    = require('./getPrefix')
var properties   = require('./prefixProps')

/**
 * Returns the given key prefixed, if the property is found in the prefixProps map.
 *
 * Does not test if the property supports the given value unprefixed.
 * If you need this, use './getPrefixed' instead
 */
module.exports = function(key, value){

	if (!properties[key]){
		return key
	}

	var prefix = getPrefix(key)

	return prefix?
				prefix + toUpperFirst(key):
				key
}
},{"./getPrefix":36,"./prefixProps":43,"./toUpperFirst":44}],35:[function(require,module,exports){
'use strict';

var getPrefix     = require('./getPrefix')
var forcePrefixed = require('./forcePrefixed')
var el            = require('./el')

var MEMORY = {}
var STYLE
var ELEMENT

module.exports = function(key, value, force){

    ELEMENT = ELEMENT || el()
    STYLE   = STYLE   ||  ELEMENT.style

    var k = key + ': ' + value

    if (MEMORY[k]){
        return MEMORY[k]
    }

    var prefix
    var prefixed
    var prefixedValue

    if (force || !(key in STYLE)){

        prefix = getPrefix('appearance')

        if (prefix){
            prefixed = forcePrefixed(key, value)

            prefixedValue = '-' + prefix.toLowerCase() + '-' + value

            if (prefixed in STYLE){
                ELEMENT.style[prefixed] = ''
                ELEMENT.style[prefixed] = prefixedValue

                if (ELEMENT.style[prefixed] !== ''){
                    value = prefixedValue
                }
            }
        }
    }

    MEMORY[k] = value

    return value
}
},{"./el":33,"./forcePrefixed":34,"./getPrefix":36}],36:[function(require,module,exports){
'use strict';

var toUpperFirst = require('./toUpperFirst')
var prefixes     = ["ms", "Moz", "Webkit", "O"]

var el = require('./el')

var ELEMENT
var PREFIX

module.exports = function(key){

	if (PREFIX !== undefined){
		return PREFIX
	}

	ELEMENT = ELEMENT || el()

	var i = 0
	var len = prefixes.length
	var tmp
	var prefix

	for (; i < len; i++){
		prefix = prefixes[i]
		tmp = prefix + toUpperFirst(key)

		if (typeof ELEMENT.style[tmp] != 'undefined'){
			return PREFIX = prefix
		}
	}

	return PREFIX
}
},{"./el":33,"./toUpperFirst":44}],37:[function(require,module,exports){
'use strict';

var getStylePrefixed = require('./getStylePrefixed')
var properties       = require('./prefixProps')

module.exports = function(key, value){

	if (!properties[key]){
		return key
	}

	return getStylePrefixed(key, value)
}
},{"./getStylePrefixed":38,"./prefixProps":43}],38:[function(require,module,exports){
'use strict';

var toUpperFirst = require('./toUpperFirst')
var getPrefix    = require('./getPrefix')
var el           = require('./el')

var MEMORY = {}
var STYLE
var ELEMENT

var PREFIX

module.exports = function(key, value){

    ELEMENT = ELEMENT || el()
    STYLE   = STYLE   || ELEMENT.style

    var k = key// + ': ' + value

    if (MEMORY[k]){
        return MEMORY[k]
    }

    var prefix
    var prefixed

    if (!(key in STYLE)){//we have to prefix

        // if (PREFIX){
        //     prefix = PREFIX
        // } else {
            prefix = getPrefix('appearance')

        //     if (prefix){
        //         prefix = PREFIX = prefix.toLowerCase()
        //     }
        // }

        if (prefix){
            prefixed = prefix + toUpperFirst(key)

            if (prefixed in STYLE){
                key = prefixed
            }
        }
    }

    MEMORY[k] = key

    return key
}
},{"./el":33,"./getPrefix":36,"./toUpperFirst":44}],39:[function(require,module,exports){
'use strict';

module.exports = function(obj, prop){
	return Object.prototype.hasOwnProperty.call(obj, prop)
}

},{}],40:[function(require,module,exports){
'use strict';

var hasOwn      = require('./hasOwn')
var getPrefixed = require('./getPrefixed')

var map      = require('./map')
var plugable = require('./plugable')

function plugins(key, value){

	var result = {
		key  : key,
		value: value
	}

	;(RESULT.plugins || []).forEach(function(fn){

		var tmp = map(function(res){
			return fn(key, value, res)
		}, result)

		if (tmp){
			result = tmp
		}
	})

	return result
}

function normalize(key, value){

	var result = plugins(key, value)

	return map(function(result){
		return {
			key  : getPrefixed(result.key, result.value),
			value: result.value
		}
	}, result)

	return result
}

var RESULT = function(style){

	var k
	var item
	var result = {}

	for (k in style) if (hasOwn(style, k)){
		item = normalize(k, style[k])

		if (!item){
			continue
		}

		map(function(item){
			result[item.key] = item.value
		}, item)
	}

	return result
}

module.exports = plugable(RESULT)
},{"./getPrefixed":37,"./hasOwn":39,"./map":41,"./plugable":42}],41:[function(require,module,exports){
'use strict';

module.exports = function(fn, item){

	if (!item){
		return
	}

	if (Array.isArray(item)){
		return item.map(fn).filter(function(x){
			return !!x
		})
	} else {
		return fn(item)
	}
}
},{}],42:[function(require,module,exports){
'use strict';

var getCssPrefixedValue = require('./getCssPrefixedValue')

module.exports = function(target){
	target.plugins = target.plugins || [
		(function(){
			var values = {
				'flex':1,
				'inline-flex':1
			}

			return function(key, value){
				if (key === 'display' && value in values){
					return {
						key  : key,
						value: getCssPrefixedValue(key, value, true)
					}
				}
			}
		})()
	]

	target.plugin = function(fn){
		target.plugins = target.plugins || []

		target.plugins.push(fn)
	}

	return target
}
},{"./getCssPrefixedValue":35}],43:[function(require,module,exports){
'use strict';

module.exports = {
  'alignItems': 1,
  'justifyContent': 1,
  'flex': 1,
  'flexFlow': 1,
  'flexGrow': 1,
  'flexShrink': 1,
  'flexBasis': 1,
  'flexDirection': 1,
  'flexWrap': 1,
  'alignContent': 1,
  'alignSelf': 1,

  'userSelect': 1,
  'transform': 1,
  'transition': 1,
  'transformOrigin': 1,
  'transformStyle': 1,
  'transitionProperty': 1,
  'transitionDuration': 1,
  'transitionTimingFunction': 1,
  'transitionDelay': 1,
  'borderImage': 1,
  'borderImageSlice': 1,
  'boxShadow': 1,
  'backgroundClip': 1,
  'backfaceVisibility': 1,
  'perspective': 1,
  'perspectiveOrigin': 1,
  'animation': 1,
  'animationDuration': 1,
  'animationName': 1,
  'animationDelay': 1,
  'animationDirection': 1,
  'animationIterationCount': 1,
  'animationTimingFunction': 1,
  'animationPlayState': 1,
  'animationFillMode': 1,
  'appearance': 1
}

},{}],44:[function(require,module,exports){
'use strict';

module.exports = function(str){
	return str?
			str.charAt(0).toUpperCase() + str.slice(1):
			''
}
},{}],45:[function(require,module,exports){
'use strict';

var Region = require('region')

/**
 *
 * Aligns this region to the given region
 * @param {Region} region
 * @param {String} alignPositions For available positions, see {@link #getPoint}
 *
 *     eg: 'tr-bl'
 *
 * @return this
 */
Region.prototype.alignToRegion = function(region, alignPositions){
    Region.align(this, region, alignPositions)

    return this
}

/**
 * Aligns this region to the given point, in the anchor position
 * @param {Object} point eg: {x: 20, y: 600}
 * @param {Number} point.x
 * @param {Number} point.y
 *
 * @param {String} anchor For available positions, see {@link #getPoint}
 *
 *     eg: 'bl'
 *
 * @return this
 */
 Region.prototype.alignToPoint = function(point, anchor){
    Region.alignToPoint(this, point, anchor)

    return this
}
},{"region":50}],46:[function(require,module,exports){
'use strict'

var Region = require('region')

/**
 * @static
 * Aligns the source region to the target region, so as to correspond to the given alignment.
 *
 * NOTE that this method makes changes on the sourceRegion in order for it to be aligned as specified.
 *
 * @param {Region} sourceRegion
 * @param {Region} targetRegion
 *
 * @param {String} align A string with 2 valid align positions, eg: 'tr-bl'.
 * For valid positions, see {@link Region#getPoint}
 *
 * Having 2 regions, we need to be able to align them as we wish:
 *
 * for example, if we have
 *
 *       source    target
 *       ________________
 *       ____
 *      |    |     ________
 *      |____|    |        |
 *                |        |
 *                |________|
 *
 * and we align 't-t', we get:
 *
 *       source    target
 *       _________________
 *
 *       ____      ________
 *      |    |    |        |
 *      |____|    |        |
 *                |________|
 *
 *  In this case, the source was moved down to be aligned to the top of the target
 *
 *
 * and if we align 'tc-tc' we get
 *
 *       source     target
 *       __________________
 *
 *                 ________
 *                | |    | |
 *                | |____| |
 *                |________|
 *
 *  Since the source was moved to have the top-center point to be the same with target top-center
 *
 *
 *
 * @return {RegionClass} The Region class
 */
Region.align = function(sourceRegion, targetRegion, align){

    targetRegion = Region.from(targetRegion)

    align = (align || 'c-c').split('-')

    //<debug>
    if (align.length != 2){
        console.warn('Incorrect region alignment! The align parameter need to be in the form \'br-c\', that is, a - separated string!', align)
    }
    //</debug>

    return Region.alignToPoint(sourceRegion, targetRegion.getPoint(align[1]), align[0])
}

/**
 * Modifies the given region to be aligned to the point, as specified by anchor
 *
 * @param {Region} region The region to align to the point
 * @param {Object} point The point to be used as a reference
 * @param {Number} point.x
 * @param {Number} point.y
 * @param {String} anchor The position where to anchor the region to the point. See {@link #getPoint} for available options/
 *
 * @return {Region} the given region
 */
Region.alignToPoint = function(region, point, anchor){

    region = Region.from(region)

    var sourcePoint = region.getPoint(anchor)
    var count       = 0
    var shiftObj    = {}

    if (
            sourcePoint.x != null &&
            point.x != null
        ){

            count++
            shiftObj.left = point.x - sourcePoint.x
    }

    if (
            sourcePoint.y != null &&
            point.y != null
        ){
            count++
            shiftObj.top = point.y - sourcePoint.y
    }

    if (count){

        region.shift(shiftObj)

    }

    return region
}
},{"region":50}],47:[function(require,module,exports){
'use strict'

var Region = require('region')

/**
 *
 * This method is trying to align the sourceRegion to the targetRegion, given the alignment positions
 * and the offsets. It only modifies the sourceRegion
 *
 * This is all well and easy, but if there is a constrainTo region, the algorithm has to take it into account.
 * In this case, it works as follows.
 *
 *  * start with the first alignment position. Aligns the region, adds the offset and then check for the constraint.
 *  * if the constraint condition is ok, return the position.
 *  * otherwise, remember the intersection area, if the regions are intersecting.
 *  * then go to the next specified align position, and so on, computing the maximum intersection area.
 *
 * If no alignment fits the constrainRegion, the sourceRegion will be resized to match it,
 * using the position with the maximum intersection area.
 *
 * Since we have computed the index of the position with the max intersection area, take that position,
 * and align the sourceRegion accordingly. Then resize the sourceRegion to the intersection, and reposition
 * it again, since resizing it might have destroyed the alignment.
 *
 * Return the position.
 *
 * @param {Region} sourceRegion
 * @param {Region} targetRegion
 * @param {String[]} positions
 * @param {Object} config
 * @param {Array} config.offset
 * @param {Region} config.constrain
 * @param {Boolean/Object} config.sync
 *
 * @return {String/Undefined} the chosen position for the alignment, or undefined if no position found
 */
function ALIGN_TO_NORMALIZED(sourceRegion, targetRegion, positions, config){

    targetRegion = Region.from(targetRegion)

    config = config  || {}

    var constrainTo = config.constrain,
        syncOption  = config.sync,
        offsets     = config.offset || [],
        syncWidth   = false,
        syncHeight  = false,
        sourceClone = sourceRegion.clone()

    /*
     * Prepare the method arguments: positions, offsets, constrain and sync options
     */
    if (!Array.isArray(positions)){
        positions = positions? [positions]: []
    }

    if (!Array.isArray(offsets)){
        offsets = offsets? [offsets]: []
    }

    if (constrainTo){
        constrainTo = constrainTo === true?
                                Region.getDocRegion():
                                constrainTo.getRegion()
    }

    if (syncOption){

        if (syncOption.size){
            syncWidth  = true
            syncHeight = true
        } else {
            syncWidth  = syncOption === true?
                            true:
                            syncOption.width || false

            syncHeight = syncOption === true?
                            true:
                            syncOption.height || false
        }
    }

    if (syncWidth){
        sourceClone.setWidth(targetRegion.getWidth())
    }
    if (syncHeight){
        sourceClone.setHeight(targetRegion.getHeight())

    }

    var offset,
        i = 0,
        len = positions.length,
        pos,
        intersection,
        itArea,
        maxArea = -1,
        maxAreaIndex = -1

    for (; i < len; i++){
        pos     = positions[i]
        offset  = offsets[i]

        sourceClone.alignToRegion(targetRegion, pos)

        if (offset){
            if (!Array.isArray(offset)){
                offset = offsets[i] = [offset.x || offset.left, offset.y || offset.top]
            }

            sourceClone.shift({
                left: offset[0],
                top : offset[1]
            })
        }

        //the source region is already aligned in the correct position

        if (constrainTo){
            //if we have a constrain region, test for the constrain
            intersection = sourceClone.getIntersection(constrainTo)

            if ( intersection && intersection.equals(sourceClone) ) {
                //constrain respected, so return (the aligned position)

                sourceRegion.set(sourceClone)
                return pos
            } else {

                //the constrain was not respected, so continue trying
                if (intersection && ((itArea = intersection.getArea()) > maxArea)){
                    maxArea      = itArea
                    maxAreaIndex = i
                }
            }

        } else {
            sourceRegion.set(sourceClone)
            return pos
        }
    }

    //no alignment respected the constraints
    if (~maxAreaIndex){
        pos     = positions[maxAreaIndex]
        offset  = offsets[maxAreaIndex]

        sourceClone.alignToRegion(targetRegion, pos)

        if (offset){
            sourceClone.shift({
                left: offset[0],
                top : offset[1]
            })
        }

        //we are sure an intersection exists, because of the way the maxAreaIndex was computed
        intersection = sourceClone.getIntersection(constrainTo)

        sourceClone.setRegion(intersection)
        sourceClone.alignToRegion(targetRegion, pos)

        if (offset){
            sourceClone.shift({
                left: offset[0],
                top : offset[1]
            })
        }

        sourceRegion.set(sourceClone)

        return pos
    }

}

module.exports = ALIGN_TO_NORMALIZED
},{"region":50}],48:[function(require,module,exports){
'use strict'

var ALIGN_TO_NORMALIZED = require('./alignToNormalized')

var Region = require('region')

/**
 * @localdoc Given source and target regions, and the given alignments required, returns a region that is the resulting allignment.
 * Does not modify the sourceRegion.
 *
 * Example
 *
 *      var sourceRegion = zippy.getInstance({
 *          alias  : 'z.region',
 *          top    : 10,
 *          left   : 10,
 *          bottom : 40,
 *          right  : 100
 *      })
 *
 *      var targetRegion = zippy.getInstance({
 *          alias  : 'z.region',
 *          top    : 10,
 *          left   : 10,
 *          bottom : 40,
 *          right  : 100
 *      })
 *      //has top-left at (10,10)
 *      //and bottom-right at (40, 100)
 *
 *      var alignRegion = alignable.COMPUTE_ALIGN_REGION(sourceRegion, targetRegion, 'tl-br')
 *
 *      //alignRegion will be a clone of sourceRegion, but will have the
 *      //top-left corner aligned with bottom-right of targetRegion
 *
 *      alignRegion.get() // => { top: 40, left: 100, bottom: 70, right: 190 }
 *
 * @param  {Region} sourceRegion The source region to align to targetRegion
 * @param  {Region} targetRegion The target region to which to align the sourceRegion
 * @param  {String/String[]} positions    A string ( delimited by "-" characters ) or an array of strings with the position to try, in the order of their priority.
 * See Region#getPoint for a list of available positions. They can be combined in any way.
 * @param  {Object} config      A config object with other configuration for the alignment
 * @param  {Object/Object[]} config.offset      Optional offsets. Either an object or an array with a different offset for each position
 * @param  {Element/Region/Boolean} config.constrain  The constrain to region or element. If the boolean true, Region.getDocRegion() will be used
 * @param  {Object/Boolean} config.sync   A boolean object that indicates whether to sync sourceRegion and targetRegion sizes (width/height or both). Can be
 *
 *  * true - in order to sync both width and height
 *  * { width: true }  - to only sync width
 *  * { height: true } - to only sync height
 *  * { size: true }   - to sync both width and height
 *
 * @return {Object} an object with the following keys:
 *
 *  * position - the position where the alignment was made. One of the given positions
 *  * region   - the region where the alignment is in place
 *  * positionChanged - boolean value indicating if the position of the returned region is different from the position of sourceRegion
 *  * widthChanged    - boolean value indicating if the width of the returned region is different from the width of sourceRegion
 *  * heightChanged   - boolean value indicating if the height of the returned region is different from the height of sourceRegion
 */
function COMPUTE_ALIGN_REGION(sourceRegion, targetRegion, positions, config){
    sourceRegion = Region.from(sourceRegion)

    var sourceClone = sourceRegion.clone()
    var position    = ALIGN_TO_NORMALIZED(sourceClone, targetRegion, positions, config)

    return {
        position        : position,
        region          : sourceClone,
        widthChanged    : sourceClone.getWidth() != sourceRegion.getWidth(),
        heightChanged   : sourceClone.getHeight() != sourceRegion.getHeight(),
        positionChanged : sourceClone.equalsPosition(sourceRegion)
    }
}


module.exports = COMPUTE_ALIGN_REGION
},{"./alignToNormalized":47,"region":50}],49:[function(require,module,exports){
'use strict';

var Region = require('region')

require('./Region.static')
require('./Region.proto')

var COMPUTE_ALIGN_REGION = require('./computeAlignRegion')

/**
 * region-align module exposes methods for aligning {@link Element} and {@link Region} instances
 *
 * The #alignTo method aligns this to the target element/region using the specified positions. See #alignTo for a graphical example.
 *
 *
 *      var div = Element.select('div.first')
 *
 *      div.alignTo(Element.select('body') , 'br-br')
 *
 *      //aligns the div to be in the bottom-right corner of the body
 *
 * Other useful methods
 *
 *  * {@link #alignRegions} - aligns a given source region to a target region
 *  * {@link #COMPUTE_ALIGN_REGION} - given a source region and a target region, and alignment positions, returns a clone of the source region, but aligned to satisfy the given alignments
 */


/**
 * Aligns sourceRegion to targetRegion. It modifies the sourceRegion in order to perform the correct alignment.
 * See #COMPUTE_ALIGN_REGION for details and examples.
 *
 * This method calls #COMPUTE_ALIGN_REGION passing to it all its arguments. The #COMPUTE_ALIGN_REGION method returns a region that is properly aligned.
 * If this returned region position/size differs from sourceRegion, then the sourceRegion is modified to be an exact copy of the aligned region.
 *
 * @inheritdoc #COMPUTE_ALIGN_REGION
 * @return {String} the position used for alignment
 */
Region.alignRegions = function(sourceRegion, targetRegion, positions, config){

    var result        = COMPUTE_ALIGN_REGION(sourceRegion, targetRegion, positions, config)
    var alignedRegion = result.region

    if ( !alignedRegion.equals(sourceRegion) ) {
        sourceRegion.setRegion(alignedRegion)
    }

    return result.position

}

    /**
     *
     * The #alignTo method aligns this to the given target region, using the specified alignment position(s).
     * You can also specify a constrain for the alignment.
     *
     * Example
     *
     *      BIG
     *      ________________________
     *      |  _______              |
     *      | |       |             |
     *      | |   A   |             |
     *      | |       |      _____  |
     *      | |_______|     |     | |
     *      |               |  B  | |
     *      |               |     | |
     *      |_______________|_____|_|
     *
     * Assume the *BIG* outside rectangle is our constrain region, and you want to align the *A* rectangle
     * to the *B* rectangle. Ideally, you'll want their tops to be aligned, and *A* to be placed at the right side of *B*
     *
     *
     *      //so we would align them using
     *
     *      A.alignTo(B, 'tl-tr', { constrain: BIG })
     *
     * But this would result in
     *
     *       BIG
     *      ________________________
     *      |                       |
     *      |                       |
     *      |                       |
     *      |                _____ _|_____
     *      |               |     | .     |
     *      |               |  B  | . A   |
     *      |               |     | .     |
     *      |_______________|_____|_._____|
     *
     *
     * Which is not what we want. So we specify an array of options to try
     *
     *      A.alignTo(B, ['tl-tr', 'tr-tl'], { constrain: BIG })
     *
     * So by this we mean: try to align A(top,left) with B(top,right) and stick to the BIG constrain. If this is not possible,
     * try the next option: align A(top,right) with B(top,left)
     *
     * So this is what we end up with
     *
     *      BIG
     *      ________________________
     *      |                       |
     *      |                       |
     *      |                       |
     *      |        _______ _____  |
     *      |       |       |     | |
     *      |       |   A   |  B  | |
     *      |       |       |     | |
     *      |_______|_______|_____|_|
     *
     *
     * Which is a lot better!
     *
     * @param {Element/Region} target The target to which to align this alignable.
     *
     * @param {String[]/String} positions The positions for the alignment.
     *
     * Example:
     *
     *      'br-tl'
     *      ['br-tl','br-tr','cx-tc']
     *
     * This method will try to align using the first position. But if there is a constrain region, that position might not satisfy the constrain.
     * If this is the case, the next positions will be tried. If one of them satifies the constrain, it will be used for aligning and it will be returned from this method.
     *
     * If no position matches the contrain, the one with the largest intersection of the source region with the constrain will be used, and this alignable will be resized to fit the constrain region.
     *
     * @param {Object} config A config object with other configuration for this method
     *
     * @param {Array[]/Object[]/Object} config.offset The offset to use for aligning. If more that one offset is specified, then offset at a given index is used with the position at the same index.
     *
     * An offset can have the following form:
     *
     *      [left_offset, top_offset]
     *      {left: left_offset, top: top_offset}
     *      {x: left_offset, y: top_offset}
     *
     * You can pass one offset or an array of offsets. In case you pass just one offset,
     * it cannot have the array form, so you cannot call
     *
     *      this.alignTo(target, positions, [10, 20])
     *
     * If you do, it will not be considered. Instead, please use
     *
     *      this.alignTo(target, positions, {x: 10, y: 20})
     *
     * Or
     *
     *      this.alignTo(target, positions, [[10, 20]] )
     *
     * @param {Boolean/Element/Region} config.constrain If boolean, target will be constrained to the document region, otherwise,
     * getRegion will be called on this argument to determine the region we need to constrain to.
     *
     * @param {Boolean/Object} config.sync Either boolean or an object with {width, height}. If it is boolean,
     * both width and height will be synced. If directions are specified, will only sync the direction which is specified as true
     *
     * @return {String}
     *
     */
Region.prototype.alignTo = function(target, positions, config){

    config = config || {}

    var sourceRegion = this
    var targetRegion = Region.from(target)

    var result = COMPUTE_ALIGN_REGION(sourceRegion, targetRegion, positions, config)
    var resultRegion = result.region

    if (!resultRegion.equalsSize(sourceRegion)){
        this.setSize(resultRegion.getSize())
    }
    if (!resultRegion.equalsPosition(sourceRegion)){
        this.setPosition(resultRegion.getPosition(), { absolute: !!config.absolute })
    }

    return result.position
}

module.exports = Region
},{"./Region.proto":45,"./Region.static":46,"./computeAlignRegion":48,"region":50}],50:[function(require,module,exports){
module.exports = require('./src')
},{"./src":52}],51:[function(require,module,exports){
'use strict';

function ToObject(val) {
	if (val == null) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

module.exports = Object.assign || function (target, source) {
	var from;
	var keys;
	var to = ToObject(target);

	for (var s = 1; s < arguments.length; s++) {
		from = arguments[s];
		keys = Object.keys(Object(from));

		for (var i = 0; i < keys.length; i++) {
			to[keys[i]] = from[keys[i]];
		}
	}

	return to;
};

},{}],52:[function(require,module,exports){
'use strict';

var hasOwn    = require('hasown')
var newify    = require('newify')

var assign      = require('object-assign');
var EventEmitter = require('events').EventEmitter

var inherits = require('./inherits')
var VALIDATE = require('./validate')

var objectToString = Object.prototype.toString

var isObject = function(value){
    return objectToString.apply(value) === '[object Object]'
}

function copyList(source, target, list){
    if (source){
        list.forEach(function(key){
            if (hasOwn(source, key)){
                target[key] = source[key]
            }
        })
    }

    return target
}

/**
 * @class Region
 *
 * The Region is an abstraction that allows the developer to refer to rectangles on the screen,
 * and move them around, make diffs and unions, detect intersections, compute areas, etc.
 *
 * ## Creating a region
 *      var region = require('region')({
 *          top  : 10,
 *          left : 10,
 *          bottom: 100,
 *          right : 100
 *      })
 *      //this region is a square, 90x90, starting from (10,10) to (100,100)
 *
 *      var second = require('region')({ top: 10, left: 100, right: 200, bottom: 60})
 *      var union  = region.getUnion(second)
 *
 *      //the "union" region is a union between "region" and "second"
 */

var POINT_POSITIONS = {
        cy: 'YCenter',
        cx: 'XCenter',
        t : 'Top',
        tc: 'TopCenter',
        tl: 'TopLeft',
        tr: 'TopRight',
        b : 'Bottom',
        bc: 'BottomCenter',
        bl: 'BottomLeft',
        br: 'BottomRight',
        l : 'Left',
        lc: 'LeftCenter',
        r : 'Right',
        rc: 'RightCenter',
        c : 'Center'
    }

/**
 * @constructor
 *
 * Construct a new Region.
 *
 * Example:
 *
 *      var r = new Region({ top: 10, left: 20, bottom: 100, right: 200 })
 *
 *      //or, the same, but with numbers (can be used with new or without)
 *
 *      r = Region(10, 200, 100, 20)
 *
 *      //or, with width and height
 *
 *      r = Region({ top: 10, left: 20, width: 180, height: 90})
 *
 * @param {Number|Object} top The top pixel position, or an object with top, left, bottom, right properties. If an object is passed,
 * instead of having bottom and right, it can have width and height.
 *
 * @param {Number} right The right pixel position
 * @param {Number} bottom The bottom pixel position
 * @param {Number} left The left pixel position
 *
 * @return {Region} this
 */
var REGION = function(top, right, bottom, left){

    if (!(this instanceof REGION)){
        return newify(REGION, arguments)
    }

    EventEmitter.call(this)

    if (isObject(top)){
        copyList(top, this, ['top','right','bottom','left'])

        if (top.bottom == null && top.height != null){
            this.bottom = this.top + top.height
        }
        if (top.right == null && top.width != null){
            this.right = this.left + top.width
        }

        if (top.emitChangeEvents){
            this.emitChangeEvents = top.emitChangeEvents
        }
    } else {
        this.top    = top
        this.right  = right
        this.bottom = bottom
        this.left   = left
    }

    this[0] = this.left
    this[1] = this.top

    VALIDATE(this)
}

inherits(REGION, EventEmitter)

assign(REGION.prototype, {

    /**
     * @cfg {Boolean} emitChangeEvents If this is set to true, the region
     * will emit 'changesize' and 'changeposition' whenever the size or the position changs
     */
    emitChangeEvents: false,

    /**
     * Returns this region, or a clone of this region
     * @param  {Boolean} [clone] If true, this method will return a clone of this region
     * @return {Region}       This region, or a clone of this
     */
    getRegion: function(clone){
        return clone?
                    this.clone():
                    this
    },

    /**
     * Sets the properties of this region to those of the given region
     * @param {Region/Object} reg The region or object to use for setting properties of this region
     * @return {Region} this
     */
    setRegion: function(reg){

        if (reg instanceof REGION){
            this.set(reg.get())
        } else {
            this.set(reg)
        }

        return this
    },

    /**
     * Returns true if this region is valid, false otherwise
     *
     * @param  {Region} region The region to check
     * @return {Boolean}        True, if the region is valid, false otherwise.
     * A region is valid if
     *  * left <= right  &&
     *  * top  <= bottom
     */
    validate: function(){
        return REGION.validate(this)
    },

    _before: function(){
        if (this.emitChangeEvents){
            return copyList(this, {}, ['left','top','bottom','right'])
        }
    },

    _after: function(before){
        if (this.emitChangeEvents){

            if(this.top != before.top || this.left != before.left) {
                this.emitPositionChange()
            }

            if(this.right != before.right || this.bottom != before.bottom) {
                this.emitSizeChange()
            }
        }
    },

    notifyPositionChange: function(){
        this.emit('changeposition', this)
    },

    emitPositionChange: function(){
        this.notifyPositionChange()
    },

    notifySizeChange: function(){
        this.emit('changesize', this)
    },

    emitSizeChange: function(){
        this.notifySizeChange()
    },

    /**
     * Add the given amounts to each specified side. Example
     *
     *      region.add({
     *          top: 50,    //add 50 px to the top side
     *          bottom: -100    //substract 100 px from the bottom side
     *      })
     *
     * @param {Object} directions
     * @param {Number} [directions.top]
     * @param {Number} [directions.left]
     * @param {Number} [directions.bottom]
     * @param {Number} [directions.right]
     *
     * @return {Region} this
     */
    add: function(directions){

        var before = this._before()
        var direction

        for (direction in directions) if ( hasOwn(directions, direction) ) {
            this[direction] += directions[direction]
        }

        this[0] = this.left
        this[1] = this.top

        this._after(before)

        return this
    },

    /**
     * The same as {@link #add}, but substracts the given values
     * @param {Object} directions
     * @param {Number} [directions.top]
     * @param {Number} [directions.left]
     * @param {Number} [directions.bottom]
     * @param {Number} [directions.right]
     *
     * @return {Region} this
     */
    substract: function(directions){

        var before = this._before()
        var direction

        for (direction in directions) if (hasOwn(directions, direction) ) {
            this[direction] -= directions[direction]
        }

        this[0] = this.left
        this[1] = this.top

        this._after(before)

        return this
    },

    /**
     * Retrieves the size of the region.
     * @return {Object} An object with {width, height}, corresponding to the width and height of the region
     */
    getSize: function(){
        return {
            width  : this.width,
            height : this.height
        }
    },

    /**
     * Move the region to the given position and keeps the region width and height.
     *
     * @param {Object} position An object with {top, left} properties. The values in {top,left} are used to move the region by the given amounts.
     * @param {Number} [position.left]
     * @param {Number} [position.top]
     *
     * @return {Region} this
     */
    setPosition: function(position){
        var width  = this.width
        var height = this.height

        if (position.left != undefined){
            position.right  = position.left + width
        }

        if (position.top != undefined){
            position.bottom = position.top  + height
        }

        return this.set(position)
    },

    /**
     * Sets both the height and the width of this region to the given size.
     *
     * @param {Number} size The new size for the region
     * @return {Region} this
     */
    setSize: function(size){
        if (size.height != undefined && size.width != undefined){
            return this.set({
                right  : this.left + size.width,
                bottom : this.top  + size.height
            })
        }

        if (size.width != undefined){
            this.setWidth(size.width)
        }

        if (size.height != undefined){
            this.setHeight(size.height)
        }

        return this
    },



    /**
     * @chainable
     *
     * Sets the width of this region
     * @param {Number} width The new width for this region
     * @return {Region} this
     */
    setWidth: function(width){
        return this.set({
            right: this.left + width
        })
    },

    /**
     * @chainable
     *
     * Sets the height of this region
     * @param {Number} height The new height for this region
     * @return {Region} this
     */
    setHeight: function(height){
        return this.set({
            bottom: this.top + height
        })
    },

    /**
     * Sets the given properties on this region
     *
     * @param {Object} directions an object containing top, left, and EITHER bottom, right OR width, height
     * @param {Number} [directions.top]
     * @param {Number} [directions.left]
     *
     * @param {Number} [directions.bottom]
     * @param {Number} [directions.right]
     *
     * @param {Number} [directions.width]
     * @param {Number} [directions.height]
     *
     *
     * @return {Region} this
     */
    set: function(directions){
        var before = this._before()

        copyList(directions, this, ['left','top','bottom','right'])

        if (directions.bottom == null && directions.height != null){
            this.bottom = this.top + directions.height
        }
        if (directions.right == null && directions.width != null){
            this.right = this.left + directions.width
        }

        this[0] = this.left
        this[1] = this.top

        this._after(before)

        return this
    },

    /**
     * Retrieves the given property from this region. If no property is given, return an object
     * with {left, top, right, bottom}
     *
     * @param {String} [dir] the property to retrieve from this region
     * @return {Number/Object}
     */
    get: function(dir){
        return dir? this[dir]:
                    copyList(this, {}, ['left','right','top','bottom'])
    },

    /**
     * Shifts this region to either top, or left or both.
     * Shift is similar to {@link #add} by the fact that it adds the given dimensions to top/left sides, but also adds the given dimensions
     * to bottom and right
     *
     * @param {Object} directions
     * @param {Number} [directions.top]
     * @param {Number} [directions.left]
     *
     * @return {Region} this
     */
    shift: function(directions){

        var before = this._before()

        if (directions.top){
            this.top    += directions.top
            this.bottom += directions.top
        }

        if (directions.left){
            this.left  += directions.left
            this.right += directions.left
        }

        this[0] = this.left
        this[1] = this.top

        this._after(before)

        return this
    },

    /**
     * Same as {@link #shift}, but substracts the given values
     * @chainable
     *
     * @param {Object} directions
     * @param {Number} [directions.top]
     * @param {Number} [directions.left]
     *
     * @return {Region} this
     */
    unshift: function(directions){

        if (directions.top){
            directions.top *= -1
        }

        if (directions.left){
            directions.left *= -1
        }

        return this.shift(directions)
    },

    /**
     * Compare this region and the given region. Return true if they have all the same size and position
     * @param  {Region} region The region to compare with
     * @return {Boolean}       True if this and region have same size and position
     */
    equals: function(region){
        return this.equalsPosition(region) && this.equalsSize(region)
    },

    /**
     * Returns true if this region has the same bottom,right properties as the given region
     * @param  {Region/Object} size The region to compare against
     * @return {Boolean}       true if this region is the same size as the given size
     */
    equalsSize: function(size){
        var isInstance = size instanceof REGION

        var s = {
            width: size.width == null && isInstance?
                    size.getWidth():
                    size.width,

            height: size.height == null && isInstance?
                    size.getHeight():
                    size.height
        }
        return this.getWidth() == s.width && this.getHeight() == s.height
    },

    /**
     * Returns true if this region has the same top,left properties as the given region
     * @param  {Region} region The region to compare against
     * @return {Boolean}       true if this.top == region.top and this.left == region.left
     */
    equalsPosition: function(region){
        return this.top == region.top && this.left == region.left
    },

    /**
     * Adds the given ammount to the left side of this region
     * @param {Number} left The ammount to add
     * @return {Region} this
     */
    addLeft: function(left){
        var before = this._before()

        this.left = this[0] = this.left + left

        this._after(before)

        return this
    },

    /**
     * Adds the given ammount to the top side of this region
     * @param {Number} top The ammount to add
     * @return {Region} this
     */
    addTop: function(top){
        var before = this._before()

        this.top = this[1] = this.top + top

        this._after(before)

        return this
    },

    /**
     * Adds the given ammount to the bottom side of this region
     * @param {Number} bottom The ammount to add
     * @return {Region} this
     */
    addBottom: function(bottom){
        var before = this._before()

        this.bottom += bottom

        this._after(before)

        return this
    },

    /**
     * Adds the given ammount to the right side of this region
     * @param {Number} right The ammount to add
     * @return {Region} this
     */
    addRight: function(right){
        var before = this._before()

        this.right += right

        this._after(before)

        return this
    },

    /**
     * Minimize the top side.
     * @return {Region} this
     */
    minTop: function(){
        return this.expand({top: 1})
    },
    /**
     * Minimize the bottom side.
     * @return {Region} this
     */
    maxBottom: function(){
        return this.expand({bottom: 1})
    },
    /**
     * Minimize the left side.
     * @return {Region} this
     */
    minLeft: function(){
        return this.expand({left: 1})
    },
    /**
     * Maximize the right side.
     * @return {Region} this
     */
    maxRight: function(){
        return this.expand({right: 1})
    },

    /**
     * Expands this region to the dimensions of the given region, or the document region, if no region is expanded.
     * But only expand the given sides (any of the four can be expanded).
     *
     * @param {Object} directions
     * @param {Boolean} [directions.top]
     * @param {Boolean} [directions.bottom]
     * @param {Boolean} [directions.left]
     * @param {Boolean} [directions.right]
     *
     * @param {Region} [region] the region to expand to, defaults to the document region
     * @return {Region} this region
     */
    expand: function(directions, region){
        var docRegion = region || REGION.getDocRegion()
        var list      = []
        var direction
        var before = this._before()

        for (direction in directions) if ( hasOwn(directions, direction) ) {
            list.push(direction)
        }

        copyList(docRegion, this, list)

        this[0] = this.left
        this[1] = this.top

        this._after(before)

        return this
    },

    /**
     * Returns a clone of this region
     * @return {Region} A new region, with the same position and dimension as this region
     */
    clone: function(){
        return new REGION({
                    top    : this.top,
                    left   : this.left,
                    right  : this.right,
                    bottom : this.bottom
                })
    },

    /**
     * Returns true if this region contains the given point
     * @param {Number/Object} x the x coordinate of the point
     * @param {Number} [y] the y coordinate of the point
     *
     * @return {Boolean} true if this region constains the given point, false otherwise
     */
    containsPoint: function(x, y){
        if (arguments.length == 1){
            y = x.y
            x = x.x
        }

        return this.left <= x  &&
               x <= this.right &&
               this.top <= y   &&
               y <= this.bottom
    },

    /**
     *
     * @param region
     *
     * @return {Boolean} true if this region contains the given region, false otherwise
     */
    containsRegion: function(region){
        return this.containsPoint(region.left, region.top)    &&
               this.containsPoint(region.right, region.bottom)
    },

    /**
     * Returns an object with the difference for {top, bottom} positions betwen this and the given region,
     *
     * See {@link #diff}
     * @param  {Region} region The region to use for diff
     * @return {Object}        {top,bottom}
     */
    diffHeight: function(region){
        return this.diff(region, {top: true, bottom: true})
    },

    /**
     * Returns an object with the difference for {left, right} positions betwen this and the given region,
     *
     * See {@link #diff}
     * @param  {Region} region The region to use for diff
     * @return {Object}        {left,right}
     */
    diffWidth: function(region){
        return this.diff(region, {left: true, right: true})
    },

    /**
     * Returns an object with the difference in sizes for the given directions, between this and region
     *
     * @param  {Region} region     The region to use for diff
     * @param  {Object} directions An object with the directions to diff. Can have any of the following keys:
     *  * left
     *  * right
     *  * top
     *  * bottom
     *
     * @return {Object} and object with the same keys as the directions object, but the values being the
     * differences between this region and the given region
     */
    diff: function(region, directions){
        var result = {}
        var dirName

        for (dirName in directions) if ( hasOwn(directions, dirName) ) {
            result[dirName] = this[dirName] - region[dirName]
        }

        return result
    },

    /**
     * Returns the position, in {left,top} properties, of this region
     *
     * @return {Object} {left,top}
     */
    getPosition: function(){
        return {
            left: this.left,
            top : this.top
        }
    },

    /**
     * Returns the point at the given position from this region.
     *
     * @param {String} position Any of:
     *
     *  * 'cx' - See {@link #getPointXCenter}
     *  * 'cy' - See {@link #getPointYCenter}
     *  * 'b'  - See {@link #getPointBottom}
     *  * 'bc' - See {@link #getPointBottomCenter}
     *  * 'l'  - See {@link #getPointLeft}F
     *  * 'lc' - See {@link #getPointLeftCenter}
     *  * 't'  - See {@link #getPointTop}
     *  * 'tc' - See {@link #getPointTopCenter}
     *  * 'r'  - See {@link #getPointRight}
     *  * 'rc' - See {@link #getPointRightCenter}
     *  * 'c'  - See {@link #getPointCenter}
     *  * 'tl' - See {@link #getPointTopLeft}
     *  * 'bl' - See {@link #getPointBottomLeft}
     *  * 'br' - See {@link #getPointBottomRight}
     *  * 'tr' - See {@link #getPointTopRight}
     *
     * @param {Boolean} asLeftTop
     *
     * @return {Object} either an object with {x,y} or {left,top} if asLeftTop is true
     */
    getPoint: function(position, asLeftTop){

        //<debug>
        if (!POINT_POSITIONS[position]) {
            console.warn('The position ', position, ' could not be found! Available options are tl, bl, tr, br, l, r, t, b.');
        }
        //</debug>

        var method = 'getPoint' + POINT_POSITIONS[position],
            result = this[method]()

        if (asLeftTop){
            return {
                left : result.x,
                top  : result.y
            }
        }

        return result
    },

    /**
     * Returns a point with x = null and y being the middle of the left region segment
     * @return {Object} {x,y}
     */
    getPointYCenter: function(){
        return { x: null, y: this.top + this.getHeight() / 2 }
    },

    /**
     * Returns a point with y = null and x being the middle of the top region segment
     * @return {Object} {x,y}
     */
    getPointXCenter: function(){
        return { x: this.left + this.getWidth() / 2, y: null }
    },

    /**
     * Returns a point with x = null and y the region top position on the y axis
     * @return {Object} {x,y}
     */
    getPointTop: function(){
        return { x: null, y: this.top }
    },

    /**
     * Returns a point that is the middle point of the region top segment
     * @return {Object} {x,y}
     */
    getPointTopCenter: function(){
        return { x: this.left + this.getWidth() / 2, y: this.top }
    },

    /**
     * Returns a point that is the top-left point of the region
     * @return {Object} {x,y}
     */
    getPointTopLeft: function(){
        return { x: this.left, y: this.top}
    },

    /**
     * Returns a point that is the top-right point of the region
     * @return {Object} {x,y}
     */
    getPointTopRight: function(){
        return { x: this.right, y: this.top}
    },

    /**
     * Returns a point with x = null and y the region bottom position on the y axis
     * @return {Object} {x,y}
     */
    getPointBottom: function(){
        return { x: null, y: this.bottom }
    },

    /**
     * Returns a point that is the middle point of the region bottom segment
     * @return {Object} {x,y}
     */
    getPointBottomCenter: function(){
        return { x: this.left + this.getWidth() / 2, y: this.bottom }
    },

    /**
     * Returns a point that is the bottom-left point of the region
     * @return {Object} {x,y}
     */
    getPointBottomLeft: function(){
        return { x: this.left, y: this.bottom}
    },

    /**
     * Returns a point that is the bottom-right point of the region
     * @return {Object} {x,y}
     */
    getPointBottomRight: function(){
        return { x: this.right, y: this.bottom}
    },

    /**
     * Returns a point with y = null and x the region left position on the x axis
     * @return {Object} {x,y}
     */
    getPointLeft: function(){
        return { x: this.left, y: null }
    },

    /**
     * Returns a point that is the middle point of the region left segment
     * @return {Object} {x,y}
     */
    getPointLeftCenter: function(){
        return { x: this.left, y: this.top + this.getHeight() / 2 }
    },

    /**
     * Returns a point with y = null and x the region right position on the x axis
     * @return {Object} {x,y}
     */
    getPointRight: function(){
        return { x: this.right, y: null }
    },

    /**
     * Returns a point that is the middle point of the region right segment
     * @return {Object} {x,y}
     */
    getPointRightCenter: function(){
        return { x: this.right, y: this.top + this.getHeight() / 2 }
    },

    /**
     * Returns a point that is the center of the region
     * @return {Object} {x,y}
     */
    getPointCenter: function(){
        return { x: this.left + this.getWidth() / 2, y: this.top + this.getHeight() / 2 }
    },

    /**
     * @return {Number} returns the height of the region
     */
    getHeight: function(){
        return this.bottom - this.top
    },

    /**
     * @return {Number} returns the width of the region
     */
    getWidth: function(){
        return this.right - this.left
    },

    /**
     * @return {Number} returns the top property of the region
     */
    getTop: function(){
        return this.top
    },

    /**
     * @return {Number} returns the left property of the region
     */
    getLeft: function(){
        return this.left
    },

    /**
     * @return {Number} returns the bottom property of the region
     */
    getBottom: function(){
        return this.bottom
    },

    /**
     * @return {Number} returns the right property of the region
     */
    getRight: function(){
        return this.right
    },

    /**
     * Returns the area of the region
     * @return {Number} the computed area
     */
    getArea: function(){
        return this.getWidth() * this.getHeight()
    },

    constrainTo: function(contrain){
        var intersect = this.getIntersection(contrain)
        var shift

        if (!intersect || !intersect.equals(this)){

            var contrainWidth  = contrain.getWidth(),
                contrainHeight = contrain.getHeight()

            if (this.getWidth() > contrainWidth){
                this.left = contrain.left
                this.setWidth(contrainWidth)
            }

            if (this.getHeight() > contrainHeight){
                this.top = contrain.top
                this.setHeight(contrainHeight)
            }

            shift = {}

            if (this.right > contrain.right){
                shift.left = contrain.right - this.right
            }

            if (this.bottom > contrain.bottom){
                shift.top = contrain.bottom - this.bottom
            }

            if (this.left < contrain.left){
                shift.left = contrain.left - this.left
            }

            if (this.top < contrain.top){
                shift.top = contrain.top - this.top
            }

            this.shift(shift)

            return true
        }

        return false
    },

    __IS_REGION: true

    /**
     * @property {Number} top
     */

    /**
     * @property {Number} right
     */

    /**
     * @property {Number} bottom
     */

    /**
     * @property {Number} left
     */

    /**
     * @property {Number} [0] the top property
     */

    /**
     * @property {Number} [1] the left property
     */

    /**
     * @method getIntersection
     * Returns a region that is the intersection of this region and the given region
     * @param  {Region} region The region to intersect with
     * @return {Region}        The intersection region
     */

    /**
     * @method getUnion
     * Returns a region that is the union of this region with the given region
     * @param  {Region} region  The region to make union with
     * @return {Region}        The union region. The smallest region that contains both this and the given region.
     */

})

Object.defineProperties(REGION.prototype, {
    width: {
        get: function(){
            return this.getWidth()
        },
        set: function(width){
            return this.setWidth(width)
        }
    },
    height: {
        get: function(){
            return this.getHeight()
        },
        set: function(height){
            return this.setHeight(height)
        }
    }
})

require('./statics')(REGION)

module.exports = REGION
},{"./inherits":53,"./statics":54,"./validate":55,"events":3,"hasown":9,"newify":31,"object-assign":51}],53:[function(require,module,exports){
'use strict';

module.exports = function(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
            value       : ctor,
            enumerable  : false,
            writable    : true,
            configurable: true
        }
    })
}
},{}],54:[function(require,module,exports){
'use strict';

var hasOwn   = require('hasown')
var VALIDATE = require('./validate')

module.exports = function(REGION){

    var MAX = Math.max
    var MIN = Math.min

    var statics = {
        init: function(){
            var exportAsNonStatic = {
                getIntersection      : true,
                getIntersectionArea  : true,
                getIntersectionHeight: true,
                getIntersectionWidth : true,
                getUnion             : true
            }
            var thisProto = REGION.prototype
            var newName

            var exportHasOwn = hasOwn(exportAsNonStatic)
            var methodName

            for (methodName in exportAsNonStatic) if (exportHasOwn(methodName)) {
                newName = exportAsNonStatic[methodName]
                if (typeof newName != 'string'){
                    newName = methodName
                }

                ;(function(proto, methodName, protoMethodName){

                    proto[methodName] = function(region){
                        //<debug>
                        if (!REGION[protoMethodName]){
                            console.warn('cannot find method ', protoMethodName,' on ', REGION)
                        }
                        //</debug>
                        return REGION[protoMethodName](this, region)
                    }

                })(thisProto, newName, methodName);
            }
        },

        validate: VALIDATE,

        /**
         * Returns the region corresponding to the documentElement
         * @return {Region} The region corresponding to the documentElement. This region is the maximum region visible on the screen.
         */
        getDocRegion: function(){
            return REGION.fromDOM(document.documentElement)
        },

        from: function(reg){
            if (reg.__IS_REGION){
                return reg
            }

            if (typeof document != 'undefined'){
                if (typeof HTMLElement != 'undefined' && reg instanceof HTMLElement){
                    return REGION.fromDOM(reg)
                }

                if (reg.type && typeof reg.pageX !== 'undefined' && typeof reg.pageY !== 'undefined'){
                    return REGION.fromEvent(reg)
                }
            }

            return REGION(reg)
        },

        fromEvent: function(event){
            return REGION.fromPoint({
                x: event.pageX,
                y: event.pageY
            })
        },

        fromDOM: function(dom){
            var rect = dom.getBoundingClientRect()
            // var docElem = document.documentElement
            // var win     = window

            // var top  = rect.top + win.pageYOffset - docElem.clientTop
            // var left = rect.left + win.pageXOffset - docElem.clientLeft

            return new REGION({
                top   : rect.top,
                left  : rect.left,
                bottom: rect.bottom,
                right : rect.right
            })
        },

        /**
         * @static
         * Returns a region that is the intersection of the given two regions
         * @param  {Region} first  The first region
         * @param  {Region} second The second region
         * @return {Region/Boolean}        The intersection region or false if no intersection found
         */
        getIntersection: function(first, second){

            var area = this.getIntersectionArea(first, second)

            if (area){
                return new REGION(area)
            }

            return false
        },

        getIntersectionWidth: function(first, second){
            var minRight  = MIN(first.right, second.right)
            var maxLeft   = MAX(first.left,  second.left)

            if (maxLeft < minRight){
                return minRight  - maxLeft
            }

            return 0
        },

        getIntersectionHeight: function(first, second){
            var maxTop    = MAX(first.top,   second.top)
            var minBottom = MIN(first.bottom,second.bottom)

            if (maxTop  < minBottom){
                return minBottom - maxTop
            }

            return 0
        },

        getIntersectionArea: function(first, second){
            var maxTop    = MAX(first.top,   second.top)
            var minRight  = MIN(first.right, second.right)
            var minBottom = MIN(first.bottom,second.bottom)
            var maxLeft   = MAX(first.left,  second.left)

            if (
                    maxTop  < minBottom &&
                    maxLeft < minRight
                ){
                return {
                    top    : maxTop,
                    right  : minRight,
                    bottom : minBottom,
                    left   : maxLeft,

                    width  : minRight  - maxLeft,
                    height : minBottom - maxTop
                }
            }

            return false
        },

        /**
         * @static
         * Returns a region that is the union of the given two regions
         * @param  {Region} first  The first region
         * @param  {Region} second The second region
         * @return {Region}        The union region. The smallest region that contains both given regions.
         */
        getUnion: function(first, second){
            var top    = MIN(first.top,   second.top)
            var right  = MAX(first.right, second.right)
            var bottom = MAX(first.bottom,second.bottom)
            var left   = MIN(first.left,  second.left)

            return new REGION(top, right, bottom, left)
        },

        /**
         * @static
         * Returns a region. If the reg argument is a region, returns it, otherwise return a new region built from the reg object.
         *
         * @param  {Region} reg A region or an object with either top, left, bottom, right or
         * with top, left, width, height
         * @return {Region} A region
         */
        getRegion: function(reg){
            return REGION.from(reg)
        },

        /**
         * Creates a region that corresponds to a point.
         *
         * @param  {Object} xy The point
         * @param  {Number} xy.x
         * @param  {Number} xy.y
         *
         * @return {Region}    The new region, with top==xy.y, bottom = xy.y and left==xy.x, right==xy.x
         */
        fromPoint: function(xy){
            return new REGION({
                        top    : xy.y,
                        bottom : xy.y,
                        left   : xy.x,
                        right  : xy.x
                    })
        }
    }

    Object.keys(statics).forEach(function(key){
        REGION[key] = statics[key]
    })

    REGION.init()
}
},{"./validate":55,"hasown":9}],55:[function(require,module,exports){
'use strict';

/**
 * @static
 * Returns true if the given region is valid, false otherwise.
 * @param  {Region} region The region to check
 * @return {Boolean}        True, if the region is valid, false otherwise.
 * A region is valid if
 *  * left <= right  &&
 *  * top  <= bottom
 */
module.exports = function validate(region){

    var isValid = true

    if (region.right < region.left){
        isValid = false
        region.right = region.left
    }

    if (region.bottom < region.top){
        isValid = false
        region.bottom = region.top
    }

    return isValid
}
},{}],56:[function(require,module,exports){
'use strict'

module.exports = {
   prefixProperties: require('./src/prefixProperties') ,
   cssUnitless: require('./src/cssUnitless') ,
   object: require('./src/toStyleObject'),
   string: require('./src/toStyleString')
}
},{"./src/cssUnitless":58,"./src/prefixProperties":63,"./src/toStyleObject":71,"./src/toStyleString":72}],57:[function(require,module,exports){
module.exports = require('./prefixer')()
},{"./prefixer":64}],58:[function(require,module,exports){
'use exports'

//make sure properties are in hyphenated form

module.exports = {
    'animation'    : 1,
    'column-count' : 1,
    'columns'      : 1,
    'font-weight'  : 1,
    'opacity'      : 1,
    'order  '      : 1,
    'z-index'      : 1,
    'zoom'         : 1,
    'flex'         : 1,
    'box-flex'     : 1,
    'transform'    : 1,
    'perspective'  : 1,
    'box-pack'     : 1,
    'box-align'    : 1,
    'colspan'      : 1,
    'rowspan'      : 1
}
},{}],59:[function(require,module,exports){
'use strict'

var objectHasOwn = Object.prototype.hasOwnProperty

module.exports = function(object, propertyName){
    return objectHasOwn.call(object, propertyName)
}
},{}],60:[function(require,module,exports){
'use strict'

var objectToString = Object.prototype.toString

module.exports = function(v) {
    return objectToString.apply(v) === '[object Function]'
}

},{}],61:[function(require,module,exports){
'use strict'

var objectToString = Object.prototype.toString

module.exports = function(v){
    return !!v && objectToString.call(v) === '[object Object]'
}


},{}],62:[function(require,module,exports){
'use strict';

var toUpperFirst = require('./stringUtils/toUpperFirst')

var re         = /^(Moz|Webkit|Khtml|O|ms|Icab)(?=[A-Z])/

var docStyle   = typeof document == 'undefined'?
                    {}:
                    document.documentElement.style

var prefixInfo = (function(){

    var prefix = (function(){

            for (var prop in docStyle) {
                if( re.test(prop) ) {
                    // test is faster than match, so it's better to perform
                    // that on the lot and match only when necessary
                    return  prop.match(re)[0]
                }
            }

            // Nothing found so far? Webkit does not enumerate over the CSS properties of the style object.
            // However (prop in style) returns the correct value, so we'll have to test for
            // the precence of a specific property
            if ('WebkitOpacity' in docStyle){
                return 'Webkit'
            }

            if ('KhtmlOpacity' in docStyle) {
                return 'Khtml'
            }

            return ''
        })(),

    lower = prefix.toLowerCase()

    return {
        style       : prefix,
        css       : '-' + lower + '-',
        dom       : ({
            Webkit: 'WebKit',
            ms    : 'MS',
            o     : 'WebKit'
        })[prefix] || toUpperFirst(prefix)
    }

})()

module.exports = prefixInfo
},{"./stringUtils/toUpperFirst":70}],63:[function(require,module,exports){
module.exports = {
    'border-radius'              : 1,
    'border-top-left-radius'     : 1,
    'border-top-right-radius'    : 1,
    'border-bottom-left-radius'  : 1,
    'border-bottom-right-radius' : 1,
    'box-shadow'                 : 1,
    'order'                      : 1,
    'flex'                       : function(name, prefix){
        return [prefix + 'box-flex']
    },
    'box-flex'                   : 1,
    'box-align'                  : 1,
    'animation'                  : 1,
    'animation-duration'         : 1,
    'animation-name'             : 1,
    'transition'                 : 1,
    'transition-duration'        : 1,
    'transform'                  : 1,
    'transform-style'            : 1,
    'transform-origin'           : 1,
    'backface-visibility'        : 1,
    'perspective'                : 1,
    'box-pack'                   : 1
}
},{}],64:[function(require,module,exports){
'use strict'

var camelize     = require('./stringUtils/camelize')
var hyphenate    = require('./stringUtils/hyphenate')
var toLowerFirst = require('./stringUtils/toLowerFirst')
var toUpperFirst = require('./stringUtils/toUpperFirst')

var prefixInfo = require('./prefixInfo')
var prefixProperties = require('./prefixProperties')

var docStyle = typeof document == 'undefined'?
                {}:
                document.documentElement.style

module.exports = function(asStylePrefix){

    return function(name, config){
        config = config || {}

        var styleName = toLowerFirst(camelize(name)),
            cssName   = hyphenate(name),

            theName   = asStylePrefix?
                            styleName:
                            cssName,

            thePrefix = prefixInfo.style?
                            asStylePrefix?
                                prefixInfo.style:
                                prefixInfo.css
                            :
                            ''

        if ( styleName in docStyle ) {
            return config.asString?
                              theName :
                            [ theName ]
        }

        //not a valid style name, so we'll return the value with a prefix

        var upperCased     = theName,
            prefixProperty = prefixProperties[cssName],
            result         = []

        if (asStylePrefix){
            upperCased = toUpperFirst(theName)
        }

        if (typeof prefixProperty == 'function'){
            var prefixedCss = prefixProperty(theName, thePrefix) || []
            if (prefixedCss && !Array.isArray(prefixedCss)){
                prefixedCss = [prefixedCss]
            }

            if (prefixedCss.length){
                prefixedCss = prefixedCss.map(function(property){
                    return asStylePrefix?
                                toLowerFirst(camelize(property)):
                                hyphenate(property)

                })
            }

            result = result.concat(prefixedCss)
        }

        if (thePrefix){
            result.push(thePrefix + upperCased)
        }

        result.push(theName)

        if (config.asString || result.length == 1){
            return result[0]
        }

        return result
    }
}
},{"./prefixInfo":62,"./prefixProperties":63,"./stringUtils/camelize":65,"./stringUtils/hyphenate":67,"./stringUtils/toLowerFirst":69,"./stringUtils/toUpperFirst":70}],65:[function(require,module,exports){
'use strict'

var toCamelFn = function(str, letter){
       return letter ? letter.toUpperCase(): ''
   }

var hyphenRe = require('./hyphenRe')

module.exports = function(str){
   return str?
          str.replace(hyphenRe, toCamelFn):
          ''
}
},{"./hyphenRe":66}],66:[function(require,module,exports){
module.exports = /[-\s]+(.)?/g
},{}],67:[function(require,module,exports){
'use strict'

var separate = require('./separate')

module.exports = function(name){
   return separate(name).toLowerCase()
}
},{"./separate":68}],68:[function(require,module,exports){
'use strict'

var doubleColonRe      = /::/g
var upperToLowerRe     = /([A-Z]+)([A-Z][a-z])/g
var lowerToUpperRe     = /([a-z\d])([A-Z])/g
var underscoreToDashRe = /_/g

module.exports = function(name, separator){

   return name?
           name.replace(doubleColonRe, '/')
                .replace(upperToLowerRe, '$1_$2')
                .replace(lowerToUpperRe, '$1_$2')
                .replace(underscoreToDashRe, separator || '-')
            :
            ''
}
},{}],69:[function(require,module,exports){
'use strict'

module.exports = function(value){
    return value.length?
                value.charAt(0).toLowerCase() + value.substring(1):
                value
}
},{}],70:[function(require,module,exports){
'use strict'

module.exports = function(value){
    return value.length?
                value.charAt(0).toUpperCase() + value.substring(1):
                value
}
},{}],71:[function(require,module,exports){
'use strict'

var prefixInfo  = require('./prefixInfo')
var cssPrefixFn = require('./cssPrefix')

var HYPHENATE   = require('./stringUtils/hyphenate')
var CAMELIZE   = require('./stringUtils/camelize')
var HAS_OWN     = require('./hasOwn')
var IS_OBJECT   = require('./isObject')
var IS_FUNCTION = require('./isFunction')

var applyPrefix = function(target, property, value, normalizeFn){
    cssPrefixFn(property).forEach(function(p){
        target[normalizeFn? normalizeFn(p): p] = value
    })
}

var toObject = function(str){
    str = (str || '').split(';')

    var result = {}

    str.forEach(function(item){
        var split = item.split(':')

        if (split.length == 2){
            result[split[0].trim()] = split[1].trim()
        }
    })

    return result
}

var CONFIG = {
    cssUnitless: require('./cssUnitless')
}

/**
 * @ignore
 * @method toStyleObject
 *
 * @param  {Object} styles The object to convert to a style object.
 * @param  {Object} [config]
 * @param  {Boolean} [config.addUnits=true] True if you want to add units when numerical values are encountered.
 * @param  {Object}  config.cssUnitless An object whose keys represent css numerical property names that will not be appended with units.
 * @param  {Object}  config.prefixProperties An object whose keys represent css property names that should be prefixed
 * @param  {String}  config.cssUnit='px' The css unit to append to numerical values. Defaults to 'px'
 * @param  {String}  config.normalizeName A function that normalizes a name to a valid css property name
 * @param  {String}  config.scope
 *
 * @return {Object} The object, normalized with css style names
 */
var TO_STYLE_OBJECT = function(styles, config, prepend, result){

    if (typeof styles == 'string'){
        styles = toObject(styles)
    }

    config = config || CONFIG

    config.cssUnitless = config.cssUnitless || CONFIG.cssUnitless

    result = result || {}

    var scope    = config.scope || {},

        //configs
        addUnits = config.addUnits != null?
                            config.addUnits:
                            scope && scope.addUnits != null?
                                scope.addUnits:
                                true,

        cssUnitless      = (config.cssUnitless != null?
                                config.cssUnitless:
                                scope?
                                    scope.cssUnitless:
                                    null) || {},
        cssUnit          = (config.cssUnit || scope? scope.cssUnit: null) || 'px',
        prefixProperties = (config.prefixProperties || (scope? scope.prefixProperties: null)) || {},

        camelize    = config.camelize,
        normalizeFn = camelize? CAMELIZE: HYPHENATE

    // Object.keys(cssUnitless).forEach(function(key){
    //     cssUnitless[normalizeFn(key)] = 1
    // })

    var processed,
        styleName,

        propName,
        propValue,
        propCssUnit,
        propType,
        propIsNumber,

        fnPropValue,
        prefix

    for (propName in styles) if (HAS_OWN(styles, propName)) {

        propValue = styles[ propName ]

        //the hyphenated style name (css property name)
        styleName = HYPHENATE(prepend? prepend + propName: propName)

        processed = false
        prefix    = false

        if (IS_FUNCTION(propValue)) {

            //a function can either return a css value
            //or an object with { value, prefix, name }
            fnPropValue = propValue.call(scope || styles, propValue, propName, styleName, styles)

            if (IS_OBJECT(fnPropValue) && fnPropValue.value != null){

                propValue = fnPropValue.value
                prefix    = fnPropValue.prefix
                styleName = fnPropValue.name?
                                HYPHENATE(fnPropValue.name):
                                styleName

            } else {
                propValue = fnPropValue
            }
        }

        propType     = typeof propValue
        propIsNumber = propType == 'number' || (propType == 'string' && propValue != '' && propValue * 1 == propValue)

        if (propValue == null || styleName == null || styleName === ''){
            continue
        }

        if (propIsNumber || propType == 'string'){
           processed = true
        }

        if (!processed && propValue.value != null && propValue.prefix){
           processed = true
           prefix    = propValue.prefix
           propValue = propValue.value
        }

        // hyphenStyleName = camelize? HYPHENATE(styleName): styleName

        if (processed){

            prefix = prefix || !!prefixProperties[styleName]

            if (propIsNumber){
                propValue = addUnits && !(styleName in cssUnitless) ?
                                propValue + cssUnit:
                                propValue + ''//change it to a string, so that jquery does not append px or other units
            }

            //special border treatment
            if (
                    (
                     styleName == 'border' ||
                    (!styleName.indexOf('border')
                        &&
                        !~styleName.indexOf('radius')
                        &&
                        !~styleName.indexOf('width'))
                    ) &&
                    propIsNumber
                ){

                styleName = styleName + '-width'
            }

            //special border radius treatment
            if (!styleName.indexOf('border-radius-')){
                styleName.replace(/border(-radius)(-(.*))/, function(str, radius, theRest){
                    var positions = {
                        '-top'    : ['-top-left',      '-top-right' ],
                        '-left'   : ['-top-left',    '-bottom-left' ],
                        '-right'  : ['-top-right',   '-bottom-right'],
                        '-bottom' : ['-bottom-left', '-bottom-right']
                    }

                    if (theRest in positions){
                        styleName = []

                        positions[theRest].forEach(function(pos){
                            styleName.push('border' + pos + radius)
                        })
                    } else {
                        styleName = 'border'+ theRest + radius
                    }

                })

                if (Array.isArray(styleName)){
                    styleName.forEach(function(styleName){
                        if (prefix){
                            applyPrefix(result, styleName, propValue, normalizeFn)
                        } else {
                            result[normalizeFn(styleName)] = propValue
                        }
                    })

                    continue
                }
            }

            if (prefix){
                applyPrefix(result, styleName, propValue, normalizeFn)
            } else {
                result[normalizeFn(styleName)] = propValue
            }

        } else {
            //the propValue must be an object, so go down the hierarchy
            TO_STYLE_OBJECT(propValue, config, styleName + '-', result)
        }
    }

    return result
}

module.exports = TO_STYLE_OBJECT
},{"./cssPrefix":57,"./cssUnitless":58,"./hasOwn":59,"./isFunction":60,"./isObject":61,"./prefixInfo":62,"./stringUtils/camelize":65,"./stringUtils/hyphenate":67}],72:[function(require,module,exports){
'use strict'

var toStyleObject = require('./toStyleObject')
var hasOwn        = require('./hasOwn')

/**
 * @ignore
 * @method toStyleString
 *
 * @param  {Object} styles The object to convert to a style string.
 * @param  {Object} config
 * @param  {Boolean} config.addUnits=true True if you want to add units when numerical values are encountered. Defaults to true
 * @param  {Object}  config.cssUnitless An object whose keys represent css numerical property names that will not be appended with units.
 * @param  {Object}  config.prefixProperties An object whose keys represent css property names that should be prefixed
 * @param  {String}  config.cssUnit='px' The css unit to append to numerical values. Defaults to 'px'
 * @param  {String}  config.scope
 *
 * @return {Object} The object, normalized with css style names
 */
module.exports = function(styles, config){
    styles = toStyleObject(styles, config)

    var result = []
    var prop

    for(prop in styles) if (hasOwn(styles, prop)){
        result.push(prop + ': ' + styles[prop])
    }

    return result.join('; ')
}
},{"./hasOwn":59,"./toStyleObject":71}],73:[function(require,module,exports){
'use strict';

var assign = require('object-assign')
var clone  = require('clone')

var DEFAULT = {
    attrName: 'data-tooltip',
    throttle: 10,
    showDelay: 500,
    offset: {
        x: 5,
        y: 5
    },
    hideOnChange: true,
    hideOnChangeDelay: 500,
    className: 'tooltip',
    style: {
        padding: 5,
        border: '1px solid gray',
        background: 'white',

    	boxSizing    : 'border-box',
    	pointerEvents: 'none',
    	position     : 'absolute',
    	visibility   : 'hidden',
    	display      : 'inline-block',
        transform    : 'translate3d(0px, 0px, 0px)',
    	transition   : 'opacity 0.3s'//, top 0.2s, left 0.2s'
    },
    visibleStyle: {
        opacity:1,
        visibility: 'visible'
    },
    hiddenStyle : {
        opacity: 0
    },
    alignPositions: null
}

var preparePositions = require('./preparePositions')

var id = 0

module.exports = function(values){
    values = values || {}

    var style        = assign({}, DEFAULT.style, values.style)
    var visibleStyle = assign({}, DEFAULT.visibleStyle, values.visibleStyle)
    var hiddenStyle  = assign({}, DEFAULT.hiddenStyle, values.hiddenStyle)

    var config = clone(assign({}, DEFAULT, values))

    config.style        = style
    config.visibleStyle = visibleStyle
    config.hiddenStyle  = hiddenStyle

    config.selector = '[' + config.attrName + ']'

    config.alignPositions = preparePositions(config.alignPositions)
    config.target = config.target || document.documentElement

    config.id = id++

    return config
}
},{"./preparePositions":80,"clone":6,"object-assign":32}],74:[function(require,module,exports){
'use strict';

var matches = require('matches-selector')

module.exports = function(root, selector){

	return function(event){

	    var target = event.target

	    while (target) {
	    	if (matches(target, selector)){
	    		return target
	    	}

	    	if (target == root){
	    		return
	    	}

	        target = target.parentNode
	    }

	}
}
},{"matches-selector":29}],75:[function(require,module,exports){
'use strict';

var throttle  = require('./throttle')
var targetFn  = require('./target')
var configure = require('./config')

var mouseenter = require('./mouseenter')
var mouseleave = require('./mouseleave')

var contains = require('contains')

var TOOLTIP = function(cfg){

	var config = configure(cfg)
	var target = targetFn(config)
	var root   = config.target
	var t      = config.throttle

	//make the target && protection since it might be destroyed by that time
    var onMouseOver = throttle(function(eventTarget){
        target && target.set(eventTarget)
    }, t)

    var onMouseOut = throttle(function(eventTarget){

        target && target.hold()
        setTimeout(function(){
            if (target && target.onHold()){
                target.set(null)
            }
        }, t)

    }, t)

    var removeMouseEnter = mouseenter(root, config.selector, onMouseOver)
    var removeMouseLeave = mouseleave(root, config.selector, onMouseOut)

    var onMouseMove = throttle(function(){
        var currentTarget = target.getCurrentTarget()

        if (currentTarget && !contains(document.documentElement, currentTarget)){
            target.set(null)
        }
    }, 200)

    root.addEventListener('mousemove', onMouseMove)

    return {
        destroy: function(){

        	target.destroy()

            removeMouseEnter()
            removeMouseLeave()
            root.removeEventListener('mousemove', onMouseMove)

			root   = null
			target = null
			config = null
        }
    }
}

module.exports = TOOLTIP
},{"./config":73,"./mouseenter":77,"./mouseleave":78,"./target":82,"./throttle":83,"contains":7}],76:[function(require,module,exports){
'use strict';

module.exports = function mapObject(obj, fn){

    var result = {}

    Object.keys(obj).forEach(function(key){
        result[key] = fn(obj[key])
    })

    return result
}
},{}],77:[function(require,module,exports){
'use strict';

var testEventMatches = require('../eventMatches');

function returnTrue(){
    return true
}

function contains(haystack, needle) {
    var targ = needle
    while (targ && targ !== haystack) {
        targ = targ.parentNode
    }
    return targ !== haystack
}

module.exports = function(el, selector, fn, config){

    var eventMatches = testEventMatches(el, selector)

    var onMouseOver = function(event){
        var target = event.target
        var related = event.relatedTarget

        // console.log(event.target, event.relatedTarget)

        // has() returns true if we move into target from related,
        // where related is a child of target

        var match

        // if (!related || (related !== target && has(target, related))){
            if (match = eventMatches(event)){
                fn(match, event)
            }
        // }
    }

    el.addEventListener('mouseover', onMouseOver)

    return function(){
        el.removeEventListener('mouseover', onMouseOver)
    }
}

},{"../eventMatches":74}],78:[function(require,module,exports){
'use strict';

var testEventMatches = require('../eventMatches');

function returnTrue(){
    return true
}

function contains(haystack, needle) {
    var targ = needle
    while (targ && targ !== haystack) {
        targ = targ.parentNode
    }
    return targ !== haystack
}

module.exports = function(el, selector, fn, config){

    var has = config && config.allowNested?
                returnTrue:
                contains

    var eventMatches = testEventMatches(el, selector)

    var onMouseOut = function(event){
        var target = event.target
        var related = event.relatedTarget

        // console.log(event.target, event.relatedTarget)

        // has() returns true if we move into target from related, 
        // where related is a child of target

        var match

        if (!related || (related !== target && has(target, related))){
            if (match = eventMatches(event)){
                fn(match, event)
            }
        }
    }

    el.addEventListener('mouseout', onMouseOut)

    return function(){
        el.removeEventListener('mouseout', onMouseOut)
    }
}

},{"../eventMatches":74}],79:[function(require,module,exports){
'use strict';

module.exports = function(str){

	var result = {}

	str.split(';').forEach(function(style){
		var parts = style.split(':')

		if (parts.length){
			result[parts[0].trim()] = parts[1].trim()
		}
	})

	return result
}
},{}],80:[function(require,module,exports){
'use strict';

var TRANSLATE_POS = {
    top: 'bc-tc',
    bottom: 'tc-bc',
    left: 'rc-lc',
    right: 'lc-rc',
    topleft: 'br-tl',
    topright: 'bl-tr',
    bottomleft: 'tr-bl',
    bottomright: 'tl-br'
}

module.exports = function preparePositions(positions){
    positions = positions || [
        'topleft',
        'topright',
        'bottomleft',
        'bottomright',
        'top',
        'bottom'
    ]

    return positions.map(function(pos){
        pos = pos.trim()
        return TRANSLATE_POS[pos] || pos
    }).filter(function(pos){
        return !!pos
    })
}
},{}],81:[function(require,module,exports){
'use strict';

var toStyleObject = require('to-style').object
var normalize     = require('react-style-normalizer')
var assign = require('object-assign')

function toStyle(style){
	return toStyleObject(normalize(style))
}

function setStyle(element, style){

	style = toStyle(style)

	Object.keys(style).forEach(function(key){
	    element.style[key] = style[key]
	})

	return element
}

module.exports = function(element, style /*, style2 */){

	var args = [].slice.call(arguments, 1)

	var styles = [{}].concat(args).map(toStyle)

	var style = assign.apply(null, styles)

	setStyle(element, style)

	return element
}
},{"object-assign":32,"react-style-normalizer":40,"to-style":56}],82:[function(require,module,exports){
'use strict';

var Region = require('region-align')

var assign = require('object-assign');
var escape = require('escape-html')

var setStyle         = require('./setStyle')
var toOffset         = require('./toOffset')
var parseAsStyle     = require('./parseAsStyle')
var tooltipElement   = require('./tooltipElement')
var preparePositions = require('./preparePositions')
var mapObject        = require('./mapObject')

function emptyObject(obj){
    return mapObject(obj, function(){
        return ''
    })
}

module.exports = function(config){

    var prevStyle

    function showTooltip(target){

        var tooltip = target.getAttribute(config.attrName)

        var el = tooltipElement(config)
        el.innerHTML = config.escape? escape(tooltip): tooltip

        var positions    = config.alignPositions
        var elRegion     = Region.from(el)
        var targetRegion = Region.from(target)

        var attrPosition = target.getAttribute(config.attrName + '-positions')
        var attrStyle    = target.getAttribute(config.attrName + '-style')

        var style = assign({}, prevStyle, config.style)

        if (attrStyle){
            attrStyle = parseAsStyle(attrStyle)
            prevStyle = emptyObject(attrStyle)

            assign(style, attrStyle)
        }

        if (attrPosition){
            positions = preparePositions(attrPosition.split(';'))
        }

        var res = elRegion.alignTo(targetRegion, positions, {
            offset: toOffset(config.offset, positions),
            constrain: true
        })

        var scrollTop = document.body.scrollTop || 0
        var scrollLeft = document.body.scrollLeft || 0

        setStyle(el, style, config.visibleStyle, {
            top : elRegion.top + scrollTop,
            left: elRegion.left + scrollLeft
        })
    }

    function clearTooltip(){
        setStyle(
            tooltipElement(config),
            config.hiddenStyle
        )
    }

    var currentTarget

    var withTarget = (function(){

        var prevId

        return function(target){

            if (target != currentTarget){
                if (prevId){
                    clearTimeout(prevId)
                    prevId = null
                }

                if (target){

                    if (config.showDelay){

                        prevId = setTimeout(function(){
                            prevId = null
                            showTooltip(target)
                        }, config.showDelay)
                    } else {
                        showTooltip(target)
                    }

                } else {
                    clearTooltip()
                }
            }

            currentTarget = target
        }
    })()

    var setter = (function(){
        var lastValue
        var PREV_ID

        return function setter(value){

            if (value == lastValue){
                return
            }

            lastValue = value

            if (config.hideOnChange){

                if (PREV_ID || value){

                    if (PREV_ID){
                        clearTimeout(PREV_ID)
                    }

                    PREV_ID = setTimeout(function(){
                        PREV_ID = null
                        withTarget(lastValue)
                    }, config.hideOnChangeDelay)
                }

                value = null
            }

            withTarget(value)
        }

    })()

    var HOLD = false

    return {

        destroy: function(){
            tooltipElement.destroy(config)
        },

        hold: function() {
            HOLD = true
        },

        onHold: function() {
            return HOLD
        },

        set: function(value){
            HOLD = false
            setter(value)
        },

        getCurrentTarget: function(){
            return currentTarget
        }
    }

}
},{"./mapObject":76,"./parseAsStyle":79,"./preparePositions":80,"./setStyle":81,"./toOffset":84,"./tooltipElement":85,"escape-html":8,"object-assign":32,"region-align":49}],83:[function(require,module,exports){
'use strict';

module.exports = function(fn, delay, scope) {
    var timeoutId = -1
    var self
    var args

    if (delay === undefined){
        delay = 0
    }

    if (delay < 0){
        return fn
    }

    return function () {

        self = scope || this
        args = arguments

        if (timeoutId !== -1) {
            //the function was called once again in the delay interval
        } else {
            timeoutId = setTimeout(function () {
                fn.apply(self, args)

                self = null
                timeoutId = -1
            }, delay)
        }

    }

}
},{}],84:[function(require,module,exports){
'use strict';

var signs = {
	t: { 
		x: 1,
		y: 1
	},
	l: {
		x: 1,
		y: 1
	},
	b: {
		x: 1,
		y: -1
	},
	r: {
		x: -1,
		y: 1
	}
}

/**
 * Given the offset (x,y, or left,top or array), returns an array of offsets, for each given position
 *
 * For example, if we align br-tl, it means we align br of tooltip to tl of target,
 * so for this position we should return an offset of {-x,-y} of the original offset
 * 
 * @param  {Object}
 * @param  {Array}
 * @return {Array}
 */
module.exports = function(offset, positions){

	if (!offset){
		return
	}

	var array

	if (Array.isArray(offset)){
		array = offset
	}

	array = offset.x != undefined?
			[offset.x, offset.y]:
			[offset.left, offset.top]

	var x = array[0]
	var y = array[1]

	return positions.map(function(pos){
		var parts = pos.split('-')

		var first = parts[0]

		var side1 = first[0]
		var side2 = first[1]

		var sign1 = signs[side1]
		var sign2 = signs[side2]

		var xSign = 1
		var ySign = 1

		if (sign1){
			xSign *= sign1.x
			ySign *= sign1.y
		}
		if (sign2){
			xSign *= sign2.x
			ySign *= sign2.y
		}

		return [x * xSign, y * ySign]
	})
}
},{}],85:[function(require,module,exports){
'use strict';

var setStyle = require('./setStyle')
var map      = {}

var result = function(config){

    var element = map[config.id]

    if (!element){
        element = setStyle(document.createElement('div'), config.style || {})
        element.className = config.className

        if (config.appendTooltip){
            config.appendTooltip(element)
        } else {
            document.body.appendChild(element)
        }
        map[config.id] = element
    }

    return element
}

result.destroy = function(config){
	var element = map[config.id]

	if (element){
		var parent = element.parentNode
		parent && parent.removeChild(element)
	}
}

module.exports = result
},{"./setStyle":81}],86:[function(require,module,exports){
const random = require("lodash/random");
const tooltip = require("tooltip");
const anime = require("animejs");

var canvas = document.getElementById("canvas");
var context = canvas.getContext("2d");
var inside = 0; 
var outside = 0;
var piScore = 0;
var error = 0;
var known = [];

function initialize() {
  context.beginPath();
  context.arc(
    canvas.width / 2,
    canvas.height / 2,
    canvas.width / 2,
    0,
    Math.PI * 2
  );
  context.strokeStyle = "#9b4dca";
  context.stroke();

  Plotly.plot(
    "error_plot",
    [
      //error
      {
        y: [],
        name: "Error",
        mode: "lines",
        line: { color: "#CC8B14" }
      },
      //pi
      {
        y: [],
        name: "Pi",

        mode: "lines",
        line: { color: "#763D99" }
      }
    ],
    {
      margin: {
        t: 30, //top margin
        l: 20, //left margin
        r: 20, //right margin
        b: 20 //bottom margin
        },
      showlegend: false,
      plot_bgcolor: "#f4f5f6",
      paper_bgcolor: "#f4f5f6"
    },
    {responsive: true}
  );
  tooltip();
}

function intro() {
  anime.timeline({ loop: false }).add({
    targets: ".intro",
    duration: 1500,
    elasticity: 500,
    delay: function(t, i) {
      return i * 15;
    },
    opacity: {
      value: [0, 1],
      duration: 300,
      easing: "linear"
    },
    translateX: function() {
      return [anime.random(0, 1) === 0 ? 100 : -100, 0];
    },
    translateY: function() {
      return [anime.random(0, 1) === 0 ? 100 : -100, 0];
    }
  });
}

function isInCircle(x, y) {
  const originX = canvas.width / 2;
  const originY = canvas.height / 2;
  const radius = canvas.width / 2;
  const dist_points =  (originX - x) * (originX - x) + (originY - y) * (originY - y);
  return dist_points <= radius * radius;
}

function setPixel(x, y) {
  context.beginPath();
  context.moveTo(x, y);
  isInCircle(x, y)
    ? (context.strokeStyle = "#FFCF40")
    : (context.strokeStyle = "#1400FF");
  context.lineTo(x + 0.4, y + 0.4);
  context.stroke();
}

function updateData() {
  document.getElementById("in").innerText = "inside: " + inside;
  document.getElementById("out").innerText = "outside: " + outside;
  document.getElementById("pi").innerText = "π: " + piScore;
  document.getElementById("error").innerText =
    "error " + parseFloat(error).toFixed(2) + "%";
}

function runMainLoop() {
  setInterval(() => {
    let x = random(0, canvas.width, false);
    let y = random(0, canvas.height, false);

    if (!known.find(p => p.x == x && p.y == y)) {
      setPixel(x, y);

      isInCircle(x, y) ? inside++ : outside++;

      piScore = (4 * inside) / (inside + outside);

      error = (Math.abs(piScore - Math.PI) / Math.PI) * 100;

      if (error < 10) {
        Plotly.extendTraces(
          "error_plot",
          {
            y: [[error], [piScore]]
          },
          [0, 1]
        );
      }

      updateData();
      known.push({ x: x, y: y });
    }
  });
}

(function() {
  initialize();
  intro();
  runMainLoop();
})();

},{"animejs":5,"lodash/random":26,"tooltip":75}]},{},[86]);

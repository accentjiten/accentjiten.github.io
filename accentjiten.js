
/*

accentjiten - Japanese pitch accent dictionary
https://github.com/accentjiten
Copyright (c) 2024 accentjiten

*/





/*
Copyright (c) 2011 Juan Mellado

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

References:
- "LZMA SDK" by Igor Pavlov
  http://www.7-zip.org/sdk.html
- "The .lzma File Format" from xz documentation
  https://github.com/joachimmetz/xz/blob/master/doc/lzma-file-format.txt
*/
var LZMA=LZMA||{};!function(e){"use strict";e.OutWindow=function(){this._windowSize=0},e.OutWindow.prototype.create=function(e){this._buffer&&this._windowSize===e||(this._buffer=new Uint8Array(e)),this._windowSize=e,this._pos=0,this._streamPos=0},e.OutWindow.prototype.flush=function(){var e=this._pos-this._streamPos;if(0!==e){if(this._stream.writeBytes)this._stream.writeBytes(this._buffer,e);else for(var t=0;t<e;t++)this._stream.writeByte(this._buffer[t]);this._pos>=this._windowSize&&(this._pos=0),this._streamPos=this._pos}},e.OutWindow.prototype.releaseStream=function(){this.flush(),this._stream=null},e.OutWindow.prototype.setStream=function(e){this.releaseStream(),this._stream=e},e.OutWindow.prototype.init=function(e){e||(this._streamPos=0,this._pos=0)},e.OutWindow.prototype.copyBlock=function(e,t){var i=this._pos-e-1;for(i<0&&(i+=this._windowSize);t--;)i>=this._windowSize&&(i=0),this._buffer[this._pos++]=this._buffer[i++],this._pos>=this._windowSize&&this.flush()},e.OutWindow.prototype.putByte=function(e){this._buffer[this._pos++]=e,this._pos>=this._windowSize&&this.flush()},e.OutWindow.prototype.getByte=function(e){var t=this._pos-e-1;return t<0&&(t+=this._windowSize),this._buffer[t]},e.RangeDecoder=function(){},e.RangeDecoder.prototype.setStream=function(e){this._stream=e},e.RangeDecoder.prototype.releaseStream=function(){this._stream=null},e.RangeDecoder.prototype.init=function(){var e=5;for(this._code=0,this._range=-1;e--;)this._code=this._code<<8|this._stream.readByte()},e.RangeDecoder.prototype.decodeDirectBits=function(e){for(var t,i=0,o=e;o--;)this._range>>>=1,t=this._code-this._range>>>31,this._code-=this._range&t-1,i=i<<1|1-t,(4278190080&this._range)==0&&(this._code=this._code<<8|this._stream.readByte(),this._range<<=8);return i},e.RangeDecoder.prototype.decodeBit=function(e,t){var i=e[t],o=(this._range>>>11)*i;return(2147483648^this._code)<(2147483648^o)?(this._range=o,e[t]+=2048-i>>>5,(4278190080&this._range)==0&&(this._code=this._code<<8|this._stream.readByte(),this._range<<=8),0):(this._range-=o,this._code-=o,e[t]-=i>>>5,(4278190080&this._range)==0&&(this._code=this._code<<8|this._stream.readByte(),this._range<<=8),1)},e.initBitModels=function(e,t){for(;t--;)e[t]=1024},e.BitTreeDecoder=function(e){this._models=[],this._numBitLevels=e},e.BitTreeDecoder.prototype.init=function(){e.initBitModels(this._models,1<<this._numBitLevels)},e.BitTreeDecoder.prototype.decode=function(e){for(var t=1,i=this._numBitLevels;i--;)t=t<<1|e.decodeBit(this._models,t);return t-(1<<this._numBitLevels)},e.BitTreeDecoder.prototype.reverseDecode=function(e){for(var t,i=1,o=0,r=0;r<this._numBitLevels;++r)t=e.decodeBit(this._models,i),i=i<<1|t,o|=t<<r;return o},e.reverseDecode2=function(e,t,i,o){for(var r,s=1,d=0,n=0;n<o;++n)r=i.decodeBit(e,t+s),s=s<<1|r,d|=r<<n;return d},e.LenDecoder=function(){this._choice=[],this._lowCoder=[],this._midCoder=[],this._highCoder=new e.BitTreeDecoder(8),this._numPosStates=0},e.LenDecoder.prototype.create=function(t){for(;this._numPosStates<t;++this._numPosStates)this._lowCoder[this._numPosStates]=new e.BitTreeDecoder(3),this._midCoder[this._numPosStates]=new e.BitTreeDecoder(3)},e.LenDecoder.prototype.init=function(){var t=this._numPosStates;for(e.initBitModels(this._choice,2);t--;)this._lowCoder[t].init(),this._midCoder[t].init();this._highCoder.init()},e.LenDecoder.prototype.decode=function(e,t){return 0===e.decodeBit(this._choice,0)?this._lowCoder[t].decode(e):0===e.decodeBit(this._choice,1)?8+this._midCoder[t].decode(e):16+this._highCoder.decode(e)},e.Decoder2=function(){this._decoders=[]},e.Decoder2.prototype.init=function(){e.initBitModels(this._decoders,768)},e.Decoder2.prototype.decodeNormal=function(e){var t=1;do t=t<<1|e.decodeBit(this._decoders,t);while(t<256);return 255&t},e.Decoder2.prototype.decodeWithMatchByte=function(e,t){var i,o,r=1;do if(i=t>>7&1,t<<=1,o=e.decodeBit(this._decoders,(1+i<<8)+r),r=r<<1|o,i!==o){for(;r<256;)r=r<<1|e.decodeBit(this._decoders,r);break}while(r<256);return 255&r},e.LiteralDecoder=function(){},e.LiteralDecoder.prototype.create=function(t,i){var o;if(!this._coders||this._numPrevBits!==i||this._numPosBits!==t)for(this._numPosBits=t,this._posMask=(1<<t)-1,this._numPrevBits=i,this._coders=[],o=1<<this._numPrevBits+this._numPosBits;o--;)this._coders[o]=new e.Decoder2},e.LiteralDecoder.prototype.init=function(){for(var e=1<<this._numPrevBits+this._numPosBits;e--;)this._coders[e].init()},e.LiteralDecoder.prototype.getDecoder=function(e,t){return this._coders[((e&this._posMask)<<this._numPrevBits)+((255&t)>>>8-this._numPrevBits)]},e.Decoder=function(){this._outWindow=new e.OutWindow,this._rangeDecoder=new e.RangeDecoder,this._isMatchDecoders=[],this._isRepDecoders=[],this._isRepG0Decoders=[],this._isRepG1Decoders=[],this._isRepG2Decoders=[],this._isRep0LongDecoders=[],this._posSlotDecoder=[],this._posDecoders=[],this._posAlignDecoder=new e.BitTreeDecoder(4),this._lenDecoder=new e.LenDecoder,this._repLenDecoder=new e.LenDecoder,this._literalDecoder=new e.LiteralDecoder,this._dictionarySize=-1,this._dictionarySizeCheck=-1,this._posSlotDecoder[0]=new e.BitTreeDecoder(6),this._posSlotDecoder[1]=new e.BitTreeDecoder(6),this._posSlotDecoder[2]=new e.BitTreeDecoder(6),this._posSlotDecoder[3]=new e.BitTreeDecoder(6)},e.Decoder.prototype.setDictionarySize=function(e){return!(e<0)&&(this._dictionarySize!==e&&(this._dictionarySize=e,this._dictionarySizeCheck=Math.max(this._dictionarySize,1),this._outWindow.create(Math.max(this._dictionarySizeCheck,4096))),!0)},e.Decoder.prototype.setLcLpPb=function(e,t,i){var o=1<<i;return!(e>8)&&!(t>4)&&!(i>4)&&(this._literalDecoder.create(t,e),this._lenDecoder.create(o),this._repLenDecoder.create(o),this._posStateMask=o-1,!0)},e.Decoder.prototype.setProperties=function(e){if(!this.setLcLpPb(e.lc,e.lp,e.pb))throw Error("Incorrect stream properties");if(!this.setDictionarySize(e.dictionarySize))throw Error("Invalid dictionary size")},e.Decoder.prototype.decodeHeader=function(e){var t,i,o,r,s,d;return!(e.size<13)&&(i=(t=e.readByte())%9,o=(t=~~(t/9))%5,r=~~(t/5),d=e.readByte(),d|=e.readByte()<<8,d|=e.readByte()<<16,d+=16777216*e.readByte(),s=e.readByte(),s|=e.readByte()<<8,s|=e.readByte()<<16,s+=16777216*e.readByte(),e.readByte(),e.readByte(),e.readByte(),e.readByte(),{lc:i,lp:o,pb:r,dictionarySize:d,uncompressedSize:s})},e.Decoder.prototype.init=function(){var t=4;for(this._outWindow.init(!1),e.initBitModels(this._isMatchDecoders,192),e.initBitModels(this._isRep0LongDecoders,192),e.initBitModels(this._isRepDecoders,12),e.initBitModels(this._isRepG0Decoders,12),e.initBitModels(this._isRepG1Decoders,12),e.initBitModels(this._isRepG2Decoders,12),e.initBitModels(this._posDecoders,114),this._literalDecoder.init();t--;)this._posSlotDecoder[t].init();this._lenDecoder.init(),this._repLenDecoder.init(),this._posAlignDecoder.init(),this._rangeDecoder.init()},e.Decoder.prototype.decodeBody=function(t,i,o){var r,s,d,n,c,h,a=0,p=0,u=0,D=0,$=0,f=0,B=0;for(this._rangeDecoder.setStream(t),this._outWindow.setStream(i),this.init();o<0||f<o;)if(r=f&this._posStateMask,0===this._rangeDecoder.decodeBit(this._isMatchDecoders,(a<<4)+r))s=this._literalDecoder.getDecoder(f++,B),B=a>=7?s.decodeWithMatchByte(this._rangeDecoder,this._outWindow.getByte(p)):s.decodeNormal(this._rangeDecoder),this._outWindow.putByte(B),a=a<4?0:a-(a<10?3:6);else{if(1===this._rangeDecoder.decodeBit(this._isRepDecoders,a))d=0,0===this._rangeDecoder.decodeBit(this._isRepG0Decoders,a)?0===this._rangeDecoder.decodeBit(this._isRep0LongDecoders,(a<<4)+r)&&(a=a<7?9:11,d=1):(0===this._rangeDecoder.decodeBit(this._isRepG1Decoders,a)?n=u:(0===this._rangeDecoder.decodeBit(this._isRepG2Decoders,a)?n=D:(n=$,$=D),D=u),u=p,p=n),0===d&&(d=2+this._repLenDecoder.decode(this._rangeDecoder,r),a=a<7?8:11);else if($=D,D=u,u=p,d=2+this._lenDecoder.decode(this._rangeDecoder,r),a=a<7?7:10,(c=this._posSlotDecoder[d<=5?d-2:3].decode(this._rangeDecoder))>=4){if(h=(c>>1)-1,p=(2|1&c)<<h,c<14)p+=e.reverseDecode2(this._posDecoders,p-c-1,this._rangeDecoder,h);else if(p+=this._rangeDecoder.decodeDirectBits(h-4)<<4,(p+=this._posAlignDecoder.reverseDecode(this._rangeDecoder))<0){if(-1===p)break;return!1}}else p=c;if(p>=f||p>=this._dictionarySizeCheck)return!1;this._outWindow.copyBlock(p,d),f+=d,B=this._outWindow.getByte(0)}return this._outWindow.flush(),this._outWindow.releaseStream(),this._rangeDecoder.releaseStream(),!0},e.Decoder.prototype.setDecoderProperties=function(e){var t,i,o,r,s;return!(e.size<5)&&(i=(t=e.readByte())%9,o=(t=~~(t/9))%5,r=~~(t/5),!!this.setLcLpPb(i,o,r)&&(s=e.readByte(),s|=e.readByte()<<8,s|=e.readByte()<<16,s+=16777216*e.readByte(),this.setDictionarySize(s)))},e.decompress=function(t,i,o,r){var s=new e.Decoder;if(!s.setDecoderProperties(t))throw Error("Incorrect lzma stream properties");if(!s.decodeBody(i,o,r))throw Error("Error in lzma data stream");return o},e.decompressFile=function(t,i){t instanceof ArrayBuffer&&(t=new e.iStream(t)),!i&&e.oStream&&(i=new e.oStream);var o=new e.Decoder,r=o.decodeHeader(t),s=r.uncompressedSize;if(o.setProperties(r),!o.decodeBody(t,i,s))throw Error("Error in lzma data stream");return i},e.decode=e.decompressFile}(LZMA);





/*
TODO:
- major website redesign
- optimize and refactor the codebase
- asynchronous workers
- dictionary caching in localStorage
*/

const input = document.createElement("input");
input.type = "text";
input.style.fontSize = "20px";

const loadingMsg = document.createElement("p");
loadingMsg.innerHTML = "Loading...";
document.body.appendChild(loadingMsg);

const desc = document.createElement("p");
desc.innerHTML = "日本語アクセント辞典<br>使い方：単語を入力で検索する<br><br>Japanese pitch accent dictionary<br>(How to use: search a word<br>Try typing \"konnichiwa\")";

const searchResults = document.createElement("p");

const ajdict = new AJDictionary();
ajdict.loadAsync().then(
	() => {
		const title = document.createElement("p");
		title.innerHTML = "accentjiten [alpha]";
		document.body.removeChild(loadingMsg);
		document.body.appendChild(title);
		document.body.appendChild(input);
		document.body.appendChild(desc);
		document.body.appendChild(searchResults);
		input.addEventListener("input", (event) => {
			const query = input.value;
			ajdict.search(query);
			const maxHTMLSearchResults = 500;
			searchResults.innerHTML = ajdict.searchResultsToHTML(maxHTMLSearchResults);
			const nResults = ajdict.nSearchResults();
			if (nResults > maxHTMLSearchResults) {
				desc.innerHTML = "全" + nResults + "件中1～" + maxHTMLSearchResults + "件を表示中 - \"<b>" + escapeHTML(query) + "</b>\"";
			} else if (nResults === 0) {
				if (query) {
					desc.innerHTML = "何も見つかりませんでした - \"<b>" + escapeHTML(query) + "</b>\"";
				} else {
					desc.innerHTML = "";
				}
			} else {
				desc.innerHTML = nResults + "件 - \"<b>" + escapeHTML(query) + "</b>\"";
			}
		});
		input.focus();
	},
	(error) => {
		console.log(error);
		const elem = document.createElement("p");
		elem.innerHTML = "Load failed";
		document.body.appendChild(elem);
	});

function escapeHTML(str) {
	return str.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;").replaceAll("'", "&#039;").replaceAll(" ", "&nbsp;");
}

function AJDictionary() {
	
	let initialized = false;
	let data = null; //Uint8Array
	let syllablePool = null; //Array<Syllable>
	let syllableFormPool = null; //Array<SyllableForm>
	let exactMatchedEntryOffsetsBuf = null; //ArrayBuffer
	let exactMatchedEntryOffsetsArr = null; //Uint32Array
	let exactMatchedEntryOffsetsN = null; //Number
	let nonExactMatchedEntryOffsetsBuf = null; //ArrayBuffer
	let nonExactMatchedEntryOffsetsArr = null; //Uint32Array
	let nonExactMatchedEntryOffsetsN = null; //Number
	const utf16leTextDecoder = new TextDecoder("utf-16le");
	const NO_MATCH = 0;
	const EXACT_MATCH = 1;
	const NON_EXACT_MATCH = 2;
	
	this.loadAsync = async function() {
		if (initialized) return;
		
		const lzmaArrayBuffer = await new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			xhr.responseType = "arraybuffer";
			xhr.addEventListener("loadend", (event) => {
				if (xhr.status >= 200 && xhr.status <= 299) {
					resolve(xhr.response);
				} else {
					reject(new Error());
				}
			});
			xhr.open("GET", "accentjiten.dat");
			xhr.send();
		});
		
		const lzmaUint8Array = new Uint8Array(lzmaArrayBuffer);
		
		const uncompressedSize = ((lzmaUint8Array[0] & 0xFF) << 24) + ((lzmaUint8Array[1] & 0xFF) << 16) +
			((lzmaUint8Array[2] & 0xFF) << 8) + ((lzmaUint8Array[3] & 0xFF));
		
		const dataUint8Array = new Uint8Array(uncompressedSize);
		
		let offset1 = 4;
		const inStream = { readByte: () => lzmaUint8Array[offset1++] };
		
		let offset2 = 0;
		const outStream = { writeByte: (byte) => { dataUint8Array[offset2++] = byte; } };
		
		LZMA.decompressFile(inStream, outStream);
		
		data = dataUint8Array;
		initialize();
		initialized = true;
	
		function initialize() {
			const entryArrayLength = getIntAt(0);
			const syllableFormPoolOffset = 4 + (entryArrayLength * 3 * 4);
			let pos = syllableFormPoolOffset;
			
			const nSyllableFormPool = getIntAt(pos);
			pos += 4;
			syllableFormPool = new Array(nSyllableFormPool);
			for (let i = 0; i < nSyllableFormPool; i++) {
				const nHiraganaMoras = getIntAt(pos);
				pos += 4;
				const hiraganaMoras = new Array(nHiraganaMoras);
				for (let j = 0; j < nHiraganaMoras; j++) {
					hiraganaMoras[j] = getStringAt(pos);
					pos += 4 + (hiraganaMoras[j].length * 2);
				}
				
				const nKatakanaMoras = getIntAt(pos);
				pos += 4;
				const katakanaMoras = new Array(nKatakanaMoras);
				for (let j = 0; j < nKatakanaMoras; j++) {
					katakanaMoras[j] = getStringAt(pos);
					pos += 4 + (katakanaMoras[j].length * 2);
				}
				
				const nRomaji = getIntAt(pos);
				pos += 4;
				const romaji = new Array(nRomaji);
				for (let j = 0; j < nRomaji; j++) {
					romaji[j] = getStringAt(pos);
					pos += 4 + (romaji[j].length * 2);
				}
				
				const isNakaguro = hiraganaMoras[0] === "・" ? true : false;
				
				syllableFormPool[i] = { hiraganaMoras: hiraganaMoras, katakanaMoras: katakanaMoras, romaji: romaji,
					hiraganaSyllable: hiraganaMoras.join(""), katakanaSyllable: katakanaMoras.join(""),
					poolIndex: i, isNakaguro: isNakaguro };
			}
			
			const nSyllablePool = getIntAt(pos);
			pos += 4;
			syllablePool = new Array(nSyllablePool);
			for (let i = 0; i < nSyllablePool; i++) {
				const syllableFormPoolIndex = getIntAt(pos);
				pos += 4;
				const syllableForm = syllableFormPool[syllableFormPoolIndex];
				const hiraganaOrKatakana = getIntAt(pos);
				pos += 4;
				const syllable = { form: syllableForm, hiraganaOrKatakana: hiraganaOrKatakana, poolIndex: i };
				syllablePool[i] = syllable;
			}
			
			exactMatchedEntryOffsetsBuf = new ArrayBuffer(entryArray_getLength() * 4);
			exactMatchedEntryOffsetsArr = new Uint32Array(exactMatchedEntryOffsetsBuf);
			nonExactMatchedEntryOffsetsBuf = new ArrayBuffer(entryArray_getLength() * 4);
			nonExactMatchedEntryOffsetsArr = new Uint32Array(nonExactMatchedEntryOffsetsBuf);
		}
		
	};
	
	this.search = function(query) {
		exactMatchedEntryOffsetsN = 0;
		nonExactMatchedEntryOffsetsN = 0;
		
		if (query.length === 0 || query.length > 100) {
			return;
		}
		
		const syllableTrie = createSyllableTrie(query);
		const entryArrayLength = entryArray_getLength();
		for (let i = 0; i < entryArrayLength; i++) {
			const entryOffset = entryArray_getEntry_entryOffset(i);
			const match1 = matchWordVariants(entryOffset, query);
			if (match1 === EXACT_MATCH) {
				exactMatchedEntryOffsetsArr[exactMatchedEntryOffsetsN++] = entryOffset;
			} else {
				const match2 = matchSyllables(entryOffset, syllableTrie);
				switch (match2) {
					case NO_MATCH:
						if (match1 === NON_EXACT_MATCH) {
							nonExactMatchedEntryOffsetsArr[nonExactMatchedEntryOffsetsN++] = entryOffset;
						}
						break;
					case NON_EXACT_MATCH:
						nonExactMatchedEntryOffsetsArr[nonExactMatchedEntryOffsetsN++] = entryOffset;
						break;
					case EXACT_MATCH:
						exactMatchedEntryOffsetsArr[exactMatchedEntryOffsetsN++] = entryOffset;
						break;
				}
			}
		}
		
		function matchWordVariants(entryOffset, query) {
			const stringArrayOffset = entry_getWordVariants_stringArrayOffset(entryOffset);
			const stringArrayLength = stringArray_getLength(stringArrayOffset);
			let anyNonExactMatch = false;
			for (let i = 0; i < stringArrayLength; i++) {
				const stringOffset = stringArray_getString_stringOffset(stringArrayOffset, i);
				const match = matchWordVariant(stringOffset, query);
				switch (match) {
					case NO_MATCH: break;
					case EXACT_MATCH: return EXACT_MATCH;
					case NON_EXACT_MATCH: { anyNonExactMatch = true; break; }
				}
			}
			return anyNonExactMatch ? NON_EXACT_MATCH : NO_MATCH;
		}
		
		function matchWordVariant(stringOffset, query) {
			const stringLength = string_getLength(stringOffset);
			const queryLength = query.length;
			for (let i = 0; i < queryLength; i++) {
				if (i >= stringLength) return null;
				const stringChar = string_getChar(stringOffset, i);
				const queryChar = query.charCodeAt(i);
				if (stringChar !== queryChar) return NO_MATCH;
			}
			return stringLength === queryLength ? EXACT_MATCH : NON_EXACT_MATCH;
		}
		
		function createSyllableTrie(query) {
			const formattedQuery = query.replace(/\s/g, "").toUpperCase();
			
			const nodes = new Array(formattedQuery.length);
			for (let i = 0; i < formattedQuery.length; i++)
				nodes[i] = { children: { }, isLeaf: false, isCompleteMatchLeaf: false };
			
			for (let i = 0; i < formattedQuery.length; i++) {
				const node = nodes[i];
				const nodeChildren = node.children;
				for (let j = 0; j < syllableFormPool.length; j++) {
					const syllableForm = syllableFormPool[j];
					const childNodes = new Set();
					for (const substring of syllableForm.romaji) {
						const substringMatch = matchSubstring(formattedQuery, i, substring);
						if (substringMatch) {
							const childNode = i + substringMatch.nMatchedChars < nodes.length
								? nodes[i + substringMatch.nMatchedChars]
								: { children: { }, isLeaf: true, isCompleteMatchLeaf: substringMatch.isCompleteMatch };
							childNodes.add(childNode);
						}
					}
					{
						const hiraganaSyllable = syllableForm.hiraganaSyllable;
						const substringMatch = matchSubstring(formattedQuery, i, hiraganaSyllable);
						if (substringMatch) {
							const childNode = i + substringMatch.nMatchedChars < nodes.length
								? nodes[i + substringMatch.nMatchedChars]
								: { children: { }, isLeaf: true, isCompleteMatchLeaf: substringMatch.isCompleteMatch };
							childNodes.add(childNode);
						}
					}
					{
						const katakanaSyllable = syllableForm.katakanaSyllable;
						const substringMatch = matchSubstring(formattedQuery, i, katakanaSyllable);
						if (substringMatch) {
							const childNode = i + substringMatch.nMatchedChars < nodes.length
								? nodes[i + substringMatch.nMatchedChars]
								: { children: { }, isLeaf: true, isCompleteMatchLeaf: substringMatch.isCompleteMatch };
							childNodes.add(childNode);
						}
					}
					if (childNodes.size > 0) {
						nodeChildren[j] = childNodes;
					}
				}
			}
			
			return nodes;
		}
		
		function matchSubstring(query, index, substring) {
			for (let i = 0; i < substring.length; i++) {
				if (index + i >= query.length) return { nMatchedChars: i, isCompleteMatch: false };
				if (query.charAt(index + i) !== substring.charAt(i)) return null;
			}
			return { nMatchedChars: substring.length, isCompleteMatch: true };
		}
		
		function matchSyllables(entryOffset, syllableTrie) {
			const nodes = syllableTrie;
			if (nodes.length === 0) return 0;
			const syllableArrayArrayOffset = entry_getReadings_syllableArrayArrayOffset(entryOffset);
			const syllableArrayArrayLength = syllableArrayArray_getLength(syllableArrayArrayOffset);
			let anyNonExactMatch = false;
			for (let i = 0; i < syllableArrayArrayLength; i++) {
				const syllableArrayOffset =
					syllableArrayArray_getSyllableArray_syllableArrayOffset(syllableArrayArrayOffset, i);
				const syllableArrayLength = syllableArray_getLength(syllableArrayOffset);
				const match = matchSyllablesRecursive(nodes[0], syllableArrayOffset, 0, syllableArrayLength);
				switch (match) {
					case NO_MATCH: break;
					case EXACT_MATCH: return EXACT_MATCH;
					case NON_EXACT_MATCH: { anyNonExactMatch = true; break; }
				}
			}
			return anyNonExactMatch ? NON_EXACT_MATCH : NO_MATCH;
		}
		
		function matchSyllablesRecursive(node, syllableArrayOffset, syllableArrayIndex, syllableArrayLength) {
			if (syllableArrayIndex >= syllableArrayLength) {
				return NO_MATCH;
			}
			const syllablePoolIndex =
				syllableArray_getSyllable_syllablePoolIndex(syllableArrayOffset, syllableArrayIndex);
			const syllable = syllablePool[syllablePoolIndex];
			const childNodes = node.children[syllable.form.poolIndex];
			if (!childNodes) {
				return NO_MATCH;
			}
			let anyNonExactMatch = false;
			for (const childNode of childNodes) {
				const match = !childNode.isLeaf
					? matchSyllablesRecursive(
						childNode, syllableArrayOffset, syllableArrayIndex + 1, syllableArrayLength)
					: childNode.isCompleteMatchLeaf && syllableArrayIndex === syllableArrayLength - 1
						? EXACT_MATCH
						: NON_EXACT_MATCH;
				switch (match) {
					case NO_MATCH: break;
					case EXACT_MATCH: return EXACT_MATCH;
					case NON_EXACT_MATCH: { anyNonExactMatch = true; break; }
				}
			}
			return anyNonExactMatch ? NON_EXACT_MATCH : NO_MATCH;
		}
		
	};
	
	this.nSearchResults = function() {
		return exactMatchedEntryOffsetsN + nonExactMatchedEntryOffsetsN;
	};
	
	this.searchResultsToHTML = function(maxResults) {
		let html = "";
		let nEntries = 0;
		
		for (let i = 0; i < exactMatchedEntryOffsetsN; i++) {
			if (nEntries > maxResults) break;
			const entryOffset = exactMatchedEntryOffsetsArr[i];
			html += entryToHTML(entryOffset);
			html += "<hr>";
			nEntries++;
		}
		
		for (let i = 0; i < nonExactMatchedEntryOffsetsN; i++) {
			if (nEntries > maxResults) break;
			const entryOffset = nonExactMatchedEntryOffsetsArr[i];
			html += entryToHTML(entryOffset);
			html += "<hr>";
			nEntries++;
		}
		
		return html;
		
		function entryToHTML(entryOffset) {
			let html = "";
			const stringArrayOffset = entry_getWordVariants_stringArrayOffset(entryOffset);
			const stringOffset = stringArray_getString_stringOffset(stringArrayOffset, 0);
			const wordVariant = string_get(stringOffset);
			html += "「";
			html += wordVariant;
			html += "」";
			const pronunciationArrayOffset = entry_getPronunciations_pronunciationArrayOffset(entryOffset);
			const pronunciationArrayLength = pronunciationArray_getLength(pronunciationArrayOffset);
			for (let i = 0; i < pronunciationArrayLength; i++) {
				const pronunciationOffset =
					pronunciationArray_getPronunciation_pronunciationOffset(pronunciationArrayOffset, i);
				const syllableArrayOffset = pronunciation_getReading_syllableArrayOffset(pronunciationOffset);
				const accent = pronunciation_getAccent(pronunciationOffset);
				const sourceArrayOffset = pronunciation_getSources_sourceArrayOffset(pronunciationOffset);
				
				const syllableArrayLength = syllableArray_getLength(syllableArrayOffset);
				html += "<div class=\"tonetext\">";
				let nMora = 0;
				for (let j = 0; j < syllableArrayLength; j++) {
					const syllablePoolIndex = syllableArray_getSyllable_syllablePoolIndex(syllableArrayOffset, j);
					const syllable = syllablePool[syllablePoolIndex];
					const syllableForm = syllable.form;
					const isNakaguro = syllableForm.isNakaguro;
					const moras = syllable.hiraganaOrKatakana === 0
						? syllableForm.hiraganaMoras : syllableForm.katakanaMoras;
					for (const mora of moras) {
						if (accent === 0) {
							if (nMora === 0) {
								html += "<span class=\"lowtonenexthigh\">";
							} else {
								html += "<span class=\"hightone\">";
							}
						} else if (accent === 1) {
							if (nMora === 0) {
								html += "<span class=\"hightone\">";
							} else if (nMora === 1) {
								html += "<span class=\"lowtoneprevioushigh\">";
							} else {
								html += "<span class=\"lowtone\">";
							}
						} else {
							if (nMora === 0) {
								html += "<span class=\"lowtonenexthigh\">";
							} else if (nMora === accent) {
								html += "<span class=\"lowtoneprevioushigh\">";
							} else if (nMora < accent) {
								html += "<span class=\"hightone\">";
							} else {
								html += "<span class=\"lowtone\">";
							}
						}
						html += mora;
						html += "</span>";
						if (!isNakaguro) {
							nMora++;
						}
					}
				}
				if (nMora === accent) {
					html += "<span class=\"lowtoneprevioushigh\"></span>";
				}
				html += "</div>";
				
				const sourceArrayLength = sourceArray_getLength(sourceArrayOffset);
				html += "<span style=\"vertical-align:middle;\"><small style=\"color:#999999;\"><small>";
				html += "&thinsp;×";
				html += sourceArrayLength;
				html += "</small></small></span>";
				if (i !== pronunciationArrayLength - 1) {
					html += "&emsp;";
				}
			}
			return html;
		}
		
	};
	
	function getIntAt(pos) {
		const b1 = data[pos] & 0xFF;
		const b2 = data[pos + 1] & 0xFF;
		const b3 = data[pos + 2] & 0xFF;
		const b4 = data[pos + 3] & 0xFF;
		return ((b1 << 24) + (b2 << 16) + (b3 << 8) + (b4));
	}
	
	function getCharAt(pos) {
		const b1 = data[pos] & 0xFF;
		const b2 = data[pos + 1] & 0xFF;
		return ((b1 << 8) + (b2));
	}
	
	function getStringAt(pos) {
		const len = getIntAt(pos);
		const buf = new ArrayBuffer(len * 2);
		const arr = new Uint16Array(buf);
		for (let i = 0; i < len; i++)
			arr[i] = getCharAt((pos + 4) + (i * 2));
		return utf16leTextDecoder.decode(buf);
	}
	
	function entryArray_getLength() {
		return getIntAt(0);
	}
	
	function entryArray_getEntry_entryOffset(index) {
		return 4 + (12 * index);
	}
	
	function entry_getWordVariants_stringArrayOffset(entryOffset) {
		return getIntAt(entryOffset);
	}
	
	function entry_getReadings_syllableArrayArrayOffset(entryOffset) {
		return getIntAt(entryOffset + 4);
	}
	
	function entry_getPronunciations_pronunciationArrayOffset(entryOffset) {
		return getIntAt(entryOffset + 8);
	}
	
	function stringArray_getLength(stringArrayOffset) {
		return getIntAt(stringArrayOffset);
	}
	
	function stringArray_getString_stringOffset(stringArrayOffset, index) {
		return getIntAt((stringArrayOffset + 4) + (index * 4));
	}
	
	function string_get(stringOffset) {
		return getStringAt(stringOffset);
	}
	
	function string_getLength(stringOffset) {
		return getIntAt(stringOffset);
	}
	
	function string_getChar(stringOffset, index) {
		return getCharAt((stringOffset + 4) + (index * 2));
	}
	
	function syllableArrayArray_getLength(syllableArrayArrayOffset) {
		return getIntAt(syllableArrayArrayOffset);
	}
	
	function syllableArrayArray_getSyllableArray_syllableArrayOffset(syllableArrayArrayOffset, index) {
		return getIntAt((syllableArrayArrayOffset + 4) + (index * 4));
	}
	
	function syllableArray_getLength(syllableArrayOffset) {
		return getIntAt(syllableArrayOffset);
	}
	
	function syllableArray_getSyllable_syllablePoolIndex(syllableArrayOffset, index) {
		return getIntAt((syllableArrayOffset + 4) + (index * 4));
	}
	
	function pronunciationArray_getLength(pronunciationArrayOffset) {
		return getIntAt(pronunciationArrayOffset);
	}
	
	function pronunciationArray_getPronunciation_pronunciationOffset(pronunciationArrayOffset, index) {
		return getIntAt((pronunciationArrayOffset + 4) + (index * 4));
	}
	
	function pronunciation_getReading_syllableArrayOffset(pronunciationOffset) {
		return getIntAt(pronunciationOffset);
	}
	
	function pronunciation_getAccent(pronunciationOffset) {
		return getIntAt(pronunciationOffset + 4);
	}
	
	function pronunciation_getSources_sourceArrayOffset(pronunciationOffset) {
		return getIntAt(pronunciationOffset + 8);
	}
	
	function sourceArray_getLength(sourceArrayOffset) {
		return getIntAt(sourceArrayOffset);
	}
	
	function sourceArray_getSource(sourceArrayOffset, index) {
		return getIntAt((sourceArrayOffset + 4) + (index * 4));
	}
	
	function entry_toObject(entryOffset) {
		const stringArrayOffset = entry_getWordVariants_stringArrayOffset(entryOffset);
		const wordVariants = stringArray_toObject(stringArrayOffset);
		const syllableArrayArrayOffset = entry_getReadings_syllableArrayArrayOffset(entryOffset);
		const readings = syllableArrayArray_toObject(syllableArrayArrayOffset);
		const pronunciationArrayOffset = entry_getPronunciations_pronunciationArrayOffset(entryOffset);
		const pronunciations = pronunciationArray_toObject(pronunciationArrayOffset);
		return { wordVariants: wordVariants, readings: readings, pronunciations: pronunciations };
	}
	
	function stringArray_toObject(stringArrayOffset) {
		const stringArrayLength = stringArray_getLength(stringArrayOffset);
		const array = new Array(stringArrayLength);
		for (let i = 0; i < stringArrayLength; i++) {
			const stringOffset = stringArray_getString_stringOffset(stringArrayOffset, i);
			const string = string_get(stringOffset);
			array[i] = string;
		}
		return array;
	}
	
	function syllableArrayArray_toObject(syllableArrayArrayOffset) {
		const syllableArrayArrayLength = syllableArrayArray_getLength(syllableArrayArrayOffset);
		const array = new Array(syllableArrayArrayLength);
		for (let i = 0; i < syllableArrayArrayLength; i++) {
			const syllableArrayOffset =
				syllableArrayArray_getSyllableArray_syllableArrayOffset(syllableArrayArrayOffset, i);
			const syllableArray = syllableArray_toObject(syllableArrayOffset);
			array[i] = syllableArray;
		}
		return array;
	}
	
	function syllableArray_toObject(syllableArrayOffset) {
		const syllableArrayLength = syllableArray_getLength(syllableArrayOffset);
		const array = new Array(syllableArrayLength);
		for (let i = 0; i < syllableArrayLength; i++) {
			const syllablePoolIndex = syllableArray_getSyllable_syllablePoolIndex(syllableArrayOffset, i);
			const syllable = syllablePool[syllablePoolIndex];
			array[i] = syllable;
		}
		return array;
	}
	
	function pronunciationArray_toObject(pronunciationArrayOffset) {
		const pronunciationArrayLength = pronunciationArray_getLength(pronunciationArrayOffset);
		const array = new Array(pronunciationArrayLength);
		for (let i = 0; i < pronunciationArrayLength; i++) {
			const pronunciationOffset =
				pronunciationArray_getPronunciation_pronunciationOffset(pronunciationArrayOffset, i);
			const pronunciation = pronunciation_toObject(pronunciationOffset);
			array[i] = pronunciation;
		}
		return array;
	}
	
	function pronunciation_toObject(pronunciationOffset) {
		const syllableArrayOffset = pronunciation_getReading_syllableArrayOffset(pronunciationOffset);
		const syllableArray = syllableArray_toObject(syllableArrayOffset);
		const accent = pronunciation_getAccent(pronunciationOffset);
		const sourceArrayOffset = pronunciation_getSources_sourceArrayOffset(pronunciationOffset);
		const sourceArray = sourceArray_toObject(sourceArrayOffset);
		return { reading: syllableArray, accent: accent, sources: sourceArray };
	}
	
	function sourceArray_toObject(sourceArrayOffset) {
		const sourceArrayLength = sourceArray_getLength(sourceArrayOffset);
		const array = new Array(sourceArrayLength);
		for (let i = 0; i < sourceArrayLength; i++) {
			const source = sourceArray_getSource(sourceArrayOffset, i);
			array[i] = source;
		}
		return array;
	}
	
}

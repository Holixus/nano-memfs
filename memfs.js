

function error(code, message) {
	var e = new Error(code+': '+message);
	e.code = code;
	Error.captureStackTrace(e, error);
	throw e;
}


function _true_() { return true; }
function _false_() { return false; }
function _newObject_() { return {}; /* Object.create(null); */ }

function clone(o) {
	if (!o || typeof o !== 'object')
		return o;

	var c = Object.create(Object.getPrototypeOf(o)),
	    keys = Object.getOwnPropertyNames(o);

	for (var i = 0, n = keys.length; i < n; ++i) {
		var key = keys[i],
		    descr = Object.getOwnPropertyDescriptor(o, key);
		if (descr.value && typeof descr.value === 'object')
			descr.value = clone(descr.value);
		Object.defineProperty(c, key, descr);
	}

	return c;
};


function norm(path) {
	path = path.split('/');
	var npath = [];
	for (var i = 0, n = path.length; i < n; ++i) {
		var key = path[i];
		switch (key) {
		case '..':
			npath.length && --npath.length;
		case '.':
		case '':
			continue;
		}
		npath.push(key);
	}
	return npath;
}

function resolve(root, path, link) {
	var path = norm(path),
	    folder = root;

	function err(code) {
		var e = new Error(code+': '+path.slice(0, i).join('/'));
		e.code = code;
		Error.captureStackTrace(e, err);
		throw e;
	}

	for (var i = 0, n = path.length, l = n-1; i < n; ++i) {
		var key = path[i];
		if (i === l)
			return [ folder, key ];
		if (!(key in folder))
			err('ENOENT');
		folder = folder[key];
		if (typeof folder !== 'object')
			err('ENOTDIR');
	}
	return [ root, '' ];
}

function JsFsStatFile(data) {
	this.size = data.length;
}

JsFsStatFile.prototype = {
	isFile: _true_,
	isDirectory: _false_,
	isBlockDevice: _false_,
	isCharacterDevice: _false_,
	isSymbolicLink: _false_,
	isFIFO: _false_,
	isSocket: _false_
};

function JsFsStatFolder() {
	this.size = 0;
}

JsFsStatFolder.prototype = {
	isFile: _false_,
	isDirectory: _true_,
	isBlockDevice: _false_,
	isCharacterDevice: _false_,
	isSymbolicLink: _false_,
	isFIFO: _false_,
	isSocket: _false_
};


function JsFS(obj) {
	this.folder = obj || _newObject_();
}

JsFS.prototype = {
	readNode: function (path) {
		return (function (folder, key) {
			if (!key)
				return folder;
			if (!(key in folder))
				error('ENOENT', path);
			return folder[key];
		}).apply(null, resolve(this.folder, path));
	},

	readFile: function (path) {
		var node = this.readNode(path);
		if (typeof node !== 'string')
			error('EISDIR', path);
		return node;
	},

	writeFile: function (path, data) {
		var res = resolve(this.folder, path);
		if (!res[1]|| ((res[1] in res[0]) && typeof res[0][res[1]] !== 'string'))
			error('EISDIR', path);
		res[0][res[1]] = data;
	},

	readTree: function (path) {
		return clone(this.readNode(path));
	},

	writeTree: function (path, tree) {
		if (typeof tree !== 'object')
			return this.writeFile(path, tree);
		var res = resolve(this.folder, path);
		if (!res[1]) {
			this.folder = clone(tree);
			return;
		}
		if ((res[1] in res[0]) && typeof res[0][res[1]] === 'string')
			error('ENOTDIR', path);
		res[0][res[1]] = clone(tree);
	},

	copy: function (src, dst) {
		var root = this.folder
		return (function (folder, key) {
			if (key && !(key in folder))
				error('ENOENT', src);
			var snode = key ? folder[key] : folder,
			    d = resolve(root, dst);
			if (!d[1] || d[1] in d[0]) {
				var dnode = d[1] ? d[0][d[1]] : root;
				switch ((typeof dnode === 'string' ? 1 : 0) + (typeof snode === 'string' ? 2 : 0)) {
				case 0: // folder -> folder
					if (key in dnode)
						error('EEXIST', dst+'/'+key);
					var cl = clone(snode);
					if (key)
						dnode[key] = cl;
					else
						if (d[1])
							d[0][d[1]] = cl;
					break;
				case 1: // folder -> file
					error('ENOTDIR', dst+'/'+key);
				case 2: // file -> folder
					if (key in dnode)
						error('EEXIST', dst+'/'+key);
					dnode[key] = snode;
					break;
				case 3: // file -> file
					d[0][d[1]] = snode;
				}
			} else
				d[0][d[1]] = clone(snode);
		}).apply(null, resolve(root, src));
	},

	stat: function (path) {
		var data = this.readNode(path);
		return new (typeof data === 'object' ? JsFsStatFolder : JsFsStatFile)(data);
	},

	unlink: function (path) {
		var res = resolve(this.folder, path);
		delete res[0][res[1]];
	},

	listFiles: function (path) {
		var files = [];
		function scan(rec, up) {
			if (typeof rec === 'string')
				return files.push(up);
			Object.keys(rec).forEach(function (subkey) {
				scan(rec[subkey], up ? up+'/'+subkey : subkey);
			});
		}
		var node = this.readNode(path);
		if (typeof node === 'string')
			error('ENOTDIR', path);
		scan(node);
		return files;
	},


	mkdir: function (path) {
		return (function (folder, key) {
			if (key in folder)
				error('EEXIST', path);
			folder[key] = _newObject_();
		}).apply(null, resolve(this.folder, path));
	},

	mkpath: function (path) {
		var folder = this.folder;
		path = path.split('/');
		for (var i = 0, n = path.length, l = n-1; i < n; ++i) {
			var key = path[i];
			if (!(key in folder))
				folder[key] = _newObject_();
			folder = folder[key];
			if (typeof folder !== 'object')
				error('ENOTDIR', path.slice(0, i).join('/'));
		}
	},

	empty: function (path) {
		var res = resolve(this.folder, path);
		if (res[1]) {
			if (!(res[1] in res[0]))
				error('ENOENT', path);
			if (typeof res[0][res[1]] === 'string')
				error('ENOTDIR', path);
		}
		var dir = res[1] ? res[0][res[1]] : this.folder;
		Object.keys(dir).forEach(function (id) { delete dir[id]; });
	}
};

module.exports = JsFS;

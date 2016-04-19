"use strict";

var assert = require('core-assert'),
    json = require('nano-json'),
    timer = require('nano-timer'),
    Promise = require('nano-promise'),
    util = require('util');


function uni_test(fn, sradix, dradix, args, ret) {
	test(fn.name+'('+json.js2str(args, sradix)+') -> '+json.js2str(ret, dradix)+'', function (done) {
		assert.deepStrictEqual(args instanceof Array ? fn.apply(null, args) : fn.call(null, args), ret);
		done();
	});
}

function massive(name, fn, pairs, sradix, dradix) {
	suite(name, function () {
		for (var i = 0, n = pairs.length; i < n; i += 2)
			uni_test(fn, sradix, dradix, pairs[i], pairs[i+1]);
	});
}

function fail_test(fn, sradix, dradix, args, ret, code) {
	test(fn.name+'('+json.js2str(args, sradix)+') -> '+ret.name+"('"+code+"')", function (done) {
		assert.throws(function () {
			if (args instanceof Array)
				fn.apply(null, args);
			else
				fn.call(null, args);
		}, function (err) {
			return (err instanceof ret) && err.code === code && true;
		}, 'no expected exception');
		done();
	});
}

function massive_fails(name, fn, pairs, sradix, dradix) {
	suite(name, function () {
		for (var i = 0, n = pairs.length; i < n; i += 3)
			fail_test(fn, sradix, dradix, pairs[i], pairs[i+1], pairs[i+2]);
	});
}


var JsFS = require('../memfs.js');

suite('readFile', function () {
	var fs = new JsFS({
		file: 'content',
		folder: {
			subfile: 'content'
		}
	});

	function readFile(a) {
		return fs.readFile(a);
	}

	massive('goods', readFile, [
		'file', 'content',
		'folder/subfile', 'content',
		'./folder/.//subfile/.', 'content',
		'folder/fake/../subfile', 'content'
	]);

	massive_fails('fails', readFile, [
		'blah', Error, 'ENOENT',
		'folder', Error, 'EISDIR'
	]);
});


suite('writeFile', function () {
	function writeFile(a, c) {
		var tree;
		(new JsFS(tree = { folder:{}, over:'o' })).writeFile(a, c);
		return tree;
	}

	massive('goods', writeFile, [
		['file', 'content'], { folder:{}, over:'o', file:'content' },
		['over', 'content'], { folder:{}, over:'content' },
		['folder/subfile', 'content'], { folder:{ subfile:'content' }, over:'o' },
		[ './folder/.//subfile/.', 'content'], { folder:{ subfile:'content' }, over:'o' },
		[ 'folder/fake/../subfile', 'content'], { folder:{ subfile:'content' }, over:'o' }
	]);

	massive_fails('fails', writeFile, [
		'folder', Error, 'EISDIR'
	]);
});


suite('unlink', function () {
	function unlink(a, c) {
		var tree = { folder:{ subfile: 'o' }, over:'o' };
		(new JsFS(tree)).unlink(a, c);
		return tree;
	}

	massive('goods', unlink, [
		'over', { folder:{ subfile: 'o' } },
		'folder', { over:'o' },
		'folder/subfile', { folder:{ }, over:'o' }
	]);

	massive_fails('fails', unlink, [
	]);
});


suite('stat', function () {
	function stat(a, prop) {
		var s = (new JsFS({ folder:{}, over:'o' })).stat(a);
		return (typeof s[prop] === 'function') ? s[prop]() : s[prop];
	}

	massive('goods', stat, [
		['over', 'size'], 1,
		['over', 'isFile'], true,
		['over', 'isDirectory'], false,
		['over', 'isBlockDevice'], false,
		['over', 'isCharacterDevice'], false,
		['over', 'isSymbolicLink'], false,
		['over', 'isFIFO'], false,
		['over', 'isSocket'], false,

		['folder', 'size'], 0,
		['folder', 'isFile'], false,
		['folder', 'isDirectory'], true,
		['folder', 'isBlockDevice'], false,
		['folder', 'isCharacterDevice'], false,
		['folder', 'isSymbolicLink'], false,
		['folder', 'isFIFO'], false,
		['folder', 'isSocket'], false
	]);

	massive_fails('fails', stat, [
		'folders', Error, 'ENOENT'
	]);
});


suite('copy', function () {
	function copy(a, b) {
		var tree,
		    s = (new JsFS(tree = {
				folder:{
					subfile:'p',
					subFile:'ere',
					subfolder: {
						o: 'o'
					} },
				Folder:{},
				over:'o'
			})).copy(a, b);
		return tree;
	}

	massive('goods', copy, [
		['folder', 'Folder'], { folder:{ subfile:'p', subFile:'ere', subfolder:{ o:'o' } }, Folder:{ folder:{ subfile:'p', subFile:'ere', subfolder:{ o:'o' } } }, over:'o' },
		['folder/subfile', '/'], { folder:{ subfile:'p', subFile:'ere', subfolder:{ o:'o' } }, Folder:{ }, over:'o', subfile:'p' },
		['folder/subfile', 'Folder'], { folder:{ subfile:'p', subFile:'ere', subfolder:{ o:'o' } }, Folder:{ subfile:'p' }, over:'o' },
		['over', '/folder'], { folder:{ subfile:'p', subFile:'ere', subfolder:{ o:'o' }, over:'o' }, Folder:{ }, over:'o' },
		['over', '/cop'], { folder:{ subfile:'p', subFile:'ere', subfolder:{ o:'o' } }, Folder:{ }, over:'o', cop:'o' },
		['over', '/folder/cop'], { folder:{ subfile:'p', subFile:'ere', subfolder:{ o:'o' }, cop:'o' }, Folder:{ }, over:'o' },
		['over', '/folder/subfile'], { folder:{ subfile:'o', subFile:'ere', subfolder:{ o:'o' } }, Folder:{ }, over:'o' },
		['folder', 'Folder/al'], { folder:{ subfile:'p', subFile:'ere', subfolder:{ o:'o' } }, Folder:{ al:{ subfile:'p', subFile:'ere', subfolder:{ o:'o' } } }, over:'o' }
	]);

	massive_fails('fails', copy, [
		[ 'folder', '' ], Error, 'EEXIST',
		[ 'folder/subfile', 'folder' ], Error, 'EEXIST',
		[ 'folder', 'over'], Error, 'ENOTDIR',
		[ 'fodder', 'over'], Error, 'ENOENT'
	]);
});


suite('readTree', function () {
	var fs = new JsFS({
			folder:{
				subfile:'p',
				subFile:'ere' },
			Folder:{},
			over:'o'
		});

	function readTree(a) {
		return fs.readTree(a).sort();
	}

	massive('goods', readTree, [
		'', [ 'folder/subFile', 'folder/subfile', 'over' ],
		'folder', [ 'subFile', 'subfile'],
		'Folder', []
	]);

	massive_fails('fails', readTree, [
		'blah', Error, 'ENOENT',
		'over', Error, 'ENOTDIR'
	]);
});


suite('mkdir', function () {
	function mkdir(a, c) {
		var tree = { folder:{ subfile: 'o' }, over:'o' };
		(new JsFS(tree)).mkdir(a, c);
		return tree;
	}

	massive('goods', mkdir, [
		'dir', { folder:{ subfile: 'o' }, over:'o', dir:{} },
		'folder/dir', { folder:{ subfile: 'o', dir:{} }, over:'o' }
	]);

	massive_fails('fails', mkdir, [
		'folder', Error, 'EEXIST',
		'folders/ok', Error, 'ENOENT'
	]);
});


suite('mkpath', function () {
	function mkpath(a, c) {
		var tree = { folder:{ subfile: 'o' }, over:'o' };
		(new JsFS(tree)).mkpath(a, c);
		return tree;
	}

	function mkpath2(a, c) {
		var fs = new JsFS();
		fs.mkpath(a, c);
		return fs.folder;
	}

	massive('goods', mkpath, [
		'dir', { folder:{ subfile: 'o' }, over:'o', dir:{} },
		'folder/dir', { folder:{ subfile: 'o', dir:{} }, over:'o' }
	]);

	massive('goods', mkpath2, [
		'dir', { dir:{} },
		'folder/dir', { folder:{ dir:{} } }
	]);

	massive_fails('fails', mkpath, [
		'over', Error, 'ENOTDIR'
	]);
});

suite('empty', function () {
	function empty(a, c) {
		var tree = {
			folder:{
				subfile:'p',
				subFile:'ere' },
			Folder:{},
			over:'o'
		};
		(new JsFS(tree)).empty(a, c);
		return tree;
	}

	massive('goods', empty, [
		'folder', { folder:{ }, Folder:{ }, over:'o' },
		'', { },
		'/', { }
	]);

	massive_fails('fails', empty, [
		'folder/subfile', Error, 'ENOTDIR',
		'folder/subfile/inf', Error, 'ENOTDIR',
		'foffer', Error, 'ENOENT'
	]);
});



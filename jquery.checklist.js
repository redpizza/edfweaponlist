/*
	jquery.checklist.js v1.01
	Copyright @edf_weapons
	
	under the MIT license.
	http://www.opensource.org/licenses/mit-license.php
*/
;(function($){
$.fn.checkList = function(option) {

// リストの出力先の要素
var element = this;

// デフォルト設定
// file : データファイルパス
// twi  : Twitter投稿ボタン表示 true / false
// text : Twitter投稿時の付属テキスト
var setting = $.extend({
	id: 'cl1',
	file: 'data.txt',
	twi: true,
	addtext: '',
	loading: true,
}, option);

// ID設定エラー
if(setting.id.match(/[^A-Za-z0-9]+/)) {
	element.append('<p style="color: red;">[checklist] ERROR : idは半角英数字で設定してください。</p>');
	return;
}

// ローダー表示
if(setting.loading) {
	element.append('<div class="cl-loading"></div>');
}

// ファイルデータ格納
var listData = [];

// 復元モード
var restoreMode = false;

// 復元コードを格納
var xCode = getHash();

// 復元コードを取得 ハッシュを優先
function getHash() {
	var url = location.hash.substr(1);
	var storage = localStorage.getItem('checklist--' + setting.id);
	var reg = new RegExp('^' + setting.id + '_[a-zA-Z0-9\-:]+$');
	
	if(url.match(reg)) {
		restoreMode = true;
		return url.substr(setting.id.length+1);
	} else if(storage) {
		return storage;
	} else {
		return '';
	}
}

// ファイル読み込み

var loadFile = $.ajax({
	url: setting.file,
	type: 'get',
	dataType: 'text',
	timeout: 20000
})
.then(function(data) {
	listData = fileConvert(data);
	
	if(!listData.err) {
		element.append(generateHtml(listData));
	} else {
		element.append('<p style="color: red;">[checklist] ERROR : ' + listData.msg + '</p>');
	}
})
.done(function() {
	$('.cl-loading').fadeOut(700);
})
.fail(function() {
	$('.cl-loading').fadeOut(700);
	element.append('<p style="color: red;">[checklist] ERROR : データファイルの読み込みに失敗しました。</p>');
});


// データファイル変換
function fileConvert(data) {
	var temp = data.split(/\r\n|\n|\r/g);
	var conv = [];
	var subNum = 0;   // サブカテゴリを数える
	var itemNum = 0;  // サブカテゴリごとのアイテムを数える
	conv.sub = [];    // サブカテゴリ名を格納
	conv.count = [];  // カテゴリごとのアイテム数を格納
	conv.all = 0;     // 合計アイテム数を格納
	conv.err = false; // エラー判定
	conv.msg = '';    // エラーメッセージ
	
	for(var i=0; i<temp.length; i++) {
		var line = i+1;
		
		// 構文外の行をスキップ
		if(!temp[i].match(/^[!?]*\|.*\|$/) && !temp[i].match(/^\*.+/)) continue;
		
		// タイトル格納
		if(temp[i].match(/^\*(?!\*).+/)) {
			conv.title = temp[i].slice(1);
		}
		
		// サブカテゴリ格納
		else if(temp[i].match(/^\*\*(?!\*).+/)) {
			conv[subNum] = [];
			conv.sub.push(temp[i].slice(2));
			subNum++;
			itemNum = 0;
			conv.count[subNum-1] = 0;
		}
		
		// アイテム格納
		else if(temp[i].match(/\|.+\|/)) {
			if(!temp[i].match(/^[!?]\|.*/)) {
				conv.count[subNum-1]++;
				conv.all++;
			}
			
			// アイテム行を分割
			conv[subNum-1][itemNum] = [];
			conv[subNum-1][itemNum] = temp[i].replace(/\[hr\]/g, '<hr class="cl-hr">').split('|');
			
			if(!conv[subNum-1][itemNum][0]) conv[subNum-1][itemNum].shift();
			if(!conv[subNum-1][itemNum][conv[subNum-1][itemNum].length-1]) conv[subNum-1][itemNum].pop();
			
			itemNum++;
		}
	}
	
	// conv.title    = タイトル名
	// conv.sub[n]   = サブカテゴリ名
	// conv.all      = アイテム総数
	// conv.count[n] = カテゴリ別アイテム数
	// conv[n][x][y] = カラム
	
	return conv;
}


// HTML生成
function generateHtml(data) {
	var output = '';
	
//	output += '<div id="' + setting.id + '">';
	output += '<div class="cl-title">' + data.title + '</div>';
	output += generateRestoreMenu(data);
	output += generateTable(data);
	output += '<p align="right"><input type="button" class="cl-clearButton" value="localStorageの削除"></p>';
//	output += '</div>';
	
	return output;
}

// 復元メニュー生成
function generateRestoreMenu(data) {
	var output = '';
	var resCode = [];  // 復元コード格納
	var resCount = []; // 復元した取得カウントを格納
	var url = location.protocol + '//' + location.host + location.pathname + location.search;
	
	// コード入力欄
	if(!restoreMode) {
		output += '<div class="cl-menu">';
		output += '<label for="cl-resbox">復元URL：</label><input type="text" class="cl-xcode" id="cl-resbox" value="' + generateUrl(xCode) + '">';
		
		if(setting.twi) {
			output += '<span class="cl-twi">';
			if(xCode) output += generateTwibutton(xCode, data.title);
			output += '</span>';
		}
	} else {
		output += '<div class="cl-menu">';
		output += '復元中：<input type="text" class="cl-xcode cl-restore" id="cl-resbox" value="' + setting.id + '_' + xCode + '" disabled>';
		output += '<input type="button" class="cl-saveButton" value="保存する">';
	}
	output += '</div>';
	
	return output;
}


// タブ・テーブル生成
function generateTable(data) {
	var output = '';
	var topMenu = '';
	var tabList = '';
	var count = 0;     // アイテム数を数える
	var resCode = [];  // 復元コード格納
	var resCount = []; // 復元した取得カウントを格納
	var skip = false;  // 特殊文法フラグ
	var tag = 'td';    // テーブルタグ切り替え
	
	// 復元コード変換
	if(xCode) {
		resCode = restoreCode(xCode);
		resCount = getCount(resCode);
	}
	
	// カウンター生成
	par = (count * 100) / data.all;
	par = Math.floor(par * Math.pow(10,1)) / Math.pow(10,1) + ' %';
	
	tabList += '<li class="cl-counter">';
	tabList += generateCounter(data.all);
	tabList += '</li>';
	
	// サブカテゴリの数だけループ
	for(var s=0; s<data.sub.length; s++) {
		
		// 復元コードが無い場合、カウンターを0にする
		if(!restoreMode && !resCount[s]) resCount[s] = 0;
		
		// タブメニュー生成
		if(s == 0) {
			tabList += '<li class="cl-tabitem cl-current">' + data.sub[s] + '<span class="cl-subcount"><span>' + resCount[s] + '</span> / ' + data.count[s] + '</span></li>';
			output += '<div class="cl-tab cl-tab-selected">';
		} else {
			tabList += '<li class="cl-tabitem">' + data.sub[s] + '<span class="cl-subcount"><span>' + resCount[s] + '</span> / ' + data.count[s] + '</span></li>';
			output += '<div class="cl-tab">';
		}
		
		// テーブル生成
		output += '<table class="cl-table">';
		
		// 行を生成
		for(var r=0; r<data[s].length; r++) {
			output += '<tr>';
			tag = 'td';
			
			// チェックボックス
			// ! : ヘッダ行
			if(data[s][r][0].match(/^!$/)) {
				output += '<th class="cl-checkbox"></th>';
				tag = 'th';
				skip = true;
			// ? : チェックなしアイテム行
			} else if(data[s][r][0].match(/^\?$/)) {
				output += '<td class="cl-checkbox cl-uncheckable">' + data[s][r][0].slice(2) + '</td>';
				skip = true;
			// チェックありアイテム行
			} else {
				// 以前にチェック済みか確認
				if(resCode && resCode[s] && resCode[s][count] == '1') {
					output += '<td class="cl-checkbox cl-checked"><input type="checkbox" checked="checked"></td>';
				} else {
					output += '<td class="cl-checkbox"><input type="checkbox"></td>';
				}
				count++;
			}
			
			// アイテム詳細列
			for(var c=0; c<data[s][r].length; c++) {
				// 特殊行の行頭記号を除去
				if(skip) {
					skip = false;
					continue;
				}
				
				// n>> : セル結合
				if(data[s][r][c].match(/^\d+>>.+/)) {
					var num = data[s][r][c].match(/^(\d+)>>.+/)[1];
					output += '<' + tag + ' colspan="' + num + '">' + data[s][r][c].replace(/^\d+>>/, '') + '</' + tag + '>';
				} else {
					output += '<' + tag + '>' + data[s][r][c] + '</' + tag + '>';
				}
			}
			output += '</tr>';
		}
		output += '</table></div>';
		count = 0;
	}
	
	// タブメニューとテーブルを結合
	output = '<ul class="cl-tablist">' + tabList + '</ul>' + output;
	
	return output;
}


// タブ切り替え
element.on('click', '.cl-tabitem', function() {
	var i = $('.cl-tabitem').index(this);
	
	$(this).siblings().removeClass('cl-current')
	$(this).addClass('cl-current');
	$('.cl-tab').siblings().removeClass('cl-tab-selected');
	$('.cl-tab').eq(i).addClass('cl-tab-selected');
});


// 復元モードでない場合のみ
if(!restoreMode) {

// チェック付け
element.on('change', '.cl-tab td input', function() {
	if($(this).prop('checked')) {
		$(this).parent('td').addClass('cl-checked');
	} else {
		$(this).parent('td').removeClass('cl-checked');
	}
});

element.on('click', '.cl-tab td', function() {
	var cbox = $(this).parent().find('input:checkbox');
	if(cbox.prop('checked')) {
		cbox.prop('checked', false).trigger('change');
	} else {
		cbox.prop('checked', true).trigger('change');
	}
});

//チェック取得
element.on('change', '.cl-tab td input:checkbox', function() {
	var id = setting.id;
	var xcode = generateCode($('.cl-tab'));
	var count = getCount(restoreCode(xcode));
	var all = 0;
	var par = 0;
	
	$('.cl-xcode').val(generateUrl(xcode));
	localStorage.setItem('checklist--' + id, xcode);
	xCode = localStorage.getItem('checklist--' + setting.id);
	
	for(var i=0; i<$('.cl-subcount').length; i++) {
		$('.cl-subcount span').eq(i).text(count[i]);
	}
	
	var temp = getCount(restoreCode(xCode));
	for(var l=0; l<temp.length; l++) {
		all = all + temp[l];
	}
	
	par = (all * 100) / listData.all;
	par = Math.floor(par * Math.pow(10,1)) / Math.pow(10,1);
	
	$('.cl-all').text(all);
	$('.cl-par').text(par + ' %');
	
	if(setting.twi) {
		$('.cl-twi').html(generateTwibutton(xcode, listData.title, id));
	}
});

// 復元コード全選択
element.on('focus', '.cl-xcode', function() {
	this.select();
});

}

// 保存ボタン
element.on('click', '.cl-saveButton', function() {
	if(window.confirm('あなたのチェックリストに上書き保存してよろしいですか？')) {
		localStorage.setItem('checklist--' + setting.id, xCode);
		location.hash = '';
		location.reload();
	}
});


// コード生成
function generateCode(data) {
	var check = [];
	var codeIn = [];
	
	for(var i=0; i<data.length; i++) {
		check[i] = [];
		var getList = $(data).eq(i).find('input:checkbox');
		if(getList.length) {
			for(var l=0; l<getList.length; l++) {
				if(l != 0 && (l % 50) === 0) check[i] += ':';
				check[i] += ($(getList).eq(l).prop('checked')) ? '1' : '0';
			}
		} else {
			check[i] = '0';
		}
	}
	
	for(var i=0; i<check.length; i++) {
		if(check[i].match(/:/)) {
			codeIn[i] = check[i].split(':');
			
			for(var l=0; l<codeIn[i].length; l++) {
				if(!codeIn[i][l].match(/1/)) codeIn[i][l] = '0';
				codeIn[i][l] = dec(codeIn[i][l].split('').reverse().join(''), true);
			}
			codeIn[i] = codeIn[i].join(':');
		} else {
			codeIn[i] = dec(check[i].split('').reverse().join(''), true);
		}
	}
	return codeIn.join('-');
}


// コード復元
function restoreCode(data) {
	var temp = data.split('-');
	var codeIn = [];
	var output = [];
	
	for(var i=0; i<temp.length; i++) {
		if(temp[i] == 0) {
			output[i] = '0';
		} else if(temp[i].match(/:/)) {
			codeIn[i] = temp[i].split(':');
			for(var l=0; l<codeIn[i].length; l++) {
				codeIn[i][l] = dec(codeIn[i][l], false);
				if(l != codeIn[i].length-1 && codeIn[i][l].length < 50) {
					codeIn[i][l] = ('00000000000000000000000000000000000000000000000000' + codeIn[i][l]).slice(-50).split('').reverse().join('');
				} else {
					codeIn[i][l] = codeIn[i][l].split('').reverse().join('');
				}
			}
			output[i] = codeIn[i].join('');
		} else {
			output[i] = dec(temp[i], false).split('').reverse().join('');
		}
		output[i] = output[i].split('');
	}
	return output;
}


// チェック数カウント
function getCount(data) {
	var count = [];
	
	for(var i=0; i<data.length; i++) {
		count[i] = 0;
		for(var l=0; l<data[i].length; l++) {
		 	if(data[i][l] == '1') count[i]++;
		}
	}
	return count;
}

function generateCounter(all) {
	var count = 0;
	var output = '';
	
	if(xCode) {
		var temp = getCount(restoreCode(xCode));
		for(var l=0; l<temp.length; l++) {
			count = count + temp[l];
		}
	}
	
	var par = (count * 100) / all;
	par = Math.floor(par * Math.pow(10,1)) / Math.pow(10,1) + ' %';
	
	// メニュー生成
	output += '<span class="cl-all">' + count + '</span> / ' + all + '<br>[ <span class="cl-par">' + par + '</span> ]';
	
	return output;
}


// ツイートボタン生成
function generateTwi(code, title) {
	var url = encodeURIComponent(location.protocol + '//' + location.host + location.pathname + location.search + '#' + setting.id + '_' + code);
	var text = title + setting.addtext + '%0D%0A';
	
	return '<a href="https://twitter.com/intent/tweet?text=' + text + '&amp;url=' + url + '" target="_blank">ツイート</a>';
}

// 復元URL生成
function generateUrl(code) {
	var hash = (code) ? '#' + setting.id + '_' : '';
	return location.protocol + '//' + location.host + location.pathname + location.search + hash + code;
}


// 2進数←→62進数変換 dec(num, true/false);
function dec(num, mode) {
	if(mode && !num.match(/1/)) return '0';
	
	var charset = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
	
	// 2進数→62進数
	if(mode) {
		var a = '';
		var b = parseInt(num, 2).toString(10);
		while ( b > 0 ){
			a = charset.charAt(b % 62)+a;
			b = Math.floor(b / 62) ;
		} return a;
	}
	
	// 62進数→2進数
	else {
		var k = 0;
		var c = num;
		for (var i=0; i <= c.length; i++) {
			for (var j=0; j < 62; j++) {
				if(charset.charAt(j) == c.charAt(i)) k += j*Math.pow(62,c.length-i-1);
			}
		} return k.toString(2);
	}
}

// localStorageの削除ボタン
element.on('click', '.cl-clearButton', function() {
	if(window.confirm('現在のチェックリストのlocalStorageを削除します。よろしいですか？\n（現ページの兵科の武器取得状況がクリアされます）')) {
		localStorage.removeItem('checklist--' + setting.id);
		location.hash = '';
		location.reload();
	}
});

// ツイートボタン（input要素版）生成
function generateTwibutton(code, title) {
	var url = encodeURIComponent(location.protocol + '//' + location.host + location.pathname + location.search + '#' + setting.id + '_' + code);
	var text = title + setting.addtext + '%0D%0A';
	return '<input type="button" class="cl-tweetButton" value="ツイート" onclick="window.open(&quot;https://twitter.com/intent/tweet?text=' + text + '&amp;url=' + url + '&quot;,&quot;_blank&quot;)">';
}

return this;
};
})(jQuery);
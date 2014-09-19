var popup = {};
var MESSAGE = {};

var Helper = {
    colors: {
        invalid: '#8B0000',
        valid: '#333',
        warning: '#FFFCD1',
        good: '#6AE450'
    },

    waiting: (function () {
        var isShow = false;
        return function (toShow) {
            if (toShow && !isShow) {
                $('.sdk-tool-mask').first().show();
                $('.sdk-tool-waiting').first().show();
                isShow = true;
            }
            else if (!toShow && isShow) {
                $('.sdk-tool-mask').first().hide();
                $('.sdk-tool-waiting').first().hide();
                isShow = false;
            }
        };
    })(),

    showTip: (function () {
        var showing = false;
        var lastTip = {};
        var consecutive = 0;
        var cumulativeTime = 0;
        var forwardStartTime = 0;
        var forwardHide = null;

        function _setColor(isErr) {
            if (isErr) {
               $('#tips').css('color', Helper.colors.invalid);
               $('#tips').css('background-color', Helper.colors.warning);
            }
            else {
               $('#tips').css('color', Helper.colors.valid);
               $('#tips').css('background-color', Helper.colors.good);
            }
        }

        function _hideTip() {
            $('#tips').hide();
            consecutive = 0;
            cumulativeTime = 0;
            showing = false;
        }

        function _showTip(tips, isErr, delayForHideAfterShow) {
            showing = true;
            lastTip = {
                tips: tips,
                isErr: isErr
            };
            $('#tips').text(tips).show();
            _setColor(isErr);
            forwardStartTime = (new Date()).getTime();
            forwardHide = setTimeout(
                function () {
                    _hideTip();
                },
                delayForHideAfterShow
            );
        }

        return function (tips, isErr) {
            if (consecutive > 3) {
                return;
            }

            if (!showing) {
                _showTip(tips, isErr, 1500);
            }
            else {
                var now = (new Date()).getTime();
                var displayedTime = now - forwardStartTime;
                var delayForHideAfterShow = 1500;
                clearTimeout(forwardHide);
                if (lastTip.tips === tips) {
                    consecutive++;
                    cumulativeTime += displayedTime;
                    delayForHideAfterShow = (2000 - cumulativeTime > 500) ? 2000 - cumulativeTime : 500;
                }
                else {
                    consecutive = 0;
                    cumulativeTime = 0;
                }
                _showTip(tips, isErr, delayForHideAfterShow);
            }
        };
    })(),

    parseError: function (errMsg) {
    },

    sendMessage: function (data, callback) {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, data, callback);
        });
    }
};

Helper.waiting(true);

function sdkPopup() {
    var _editorGet = [];
    var _editorSet = [];
    var _bindEvents = function (datasource) {
        $('#sdk-tool-main').off(
            'click',
            '.sdk-set-value-btn, .sdk-copy-get-value, .sdk-toggle-get-value, .sdk-paste-value'
        );
        $('#sdk-tool-main').on(
            'click',
            '.sdk-set-value-btn, .sdk-copy-get-value, .sdk-toggle-get-value, .sdk-paste-value',
            function (e) {
                var button = $(e.currentTarget);
                var index = button.attr('index');
                if (button.hasClass('sdk-set-value-btn')) {
                    var valueToSet = _editorSet[index].getText();
                    if (!valueToSet) {
                        Helper.showTip('亲忘了填数据...', true);
                        return;
                    }
                    Helper.sendMessage({
                        code: MESSAGE.SET_SDK_VALUE,
                        name: datasource[index].id,
                        index: index,
                        value: valueToSet
                    });
                }
                else if (button.hasClass('sdk-copy-get-value')) {
                    $('.sdk-raw-value:eq(' + index +')')
                        .val(datasource[index].value)
                        .select();
                    document.execCommand('copy');

                    Helper.showTip('复制成功!');
                }
                else if (button.hasClass('sdk-paste-value')) {
                    var rawValueTextarea = $('.sdk-raw-value:eq(' + index +')');
                    rawValueTextarea.select();
                    document.execCommand('paste');
                    _editorSet[index].set(JSON.parse(rawValueTextarea.val()));

                    Helper.showTip('粘贴成功!');
                }
                else if (button.hasClass('sdk-toggle-get-value')) {
                    var target = $('.sdk-fieldset:eq(' + index +')');
                    if (target.hasClass('sdk-fieldset-toggle')) {
                        button.text('收起');
                        target.removeClass('sdk-fieldset-toggle');
                    }
                    else {
                        button.text('展开');
                        target.addClass('sdk-fieldset-toggle');
                    }
                    setTimeout(
                        function () {
                            _editorGet[index].resize();
                            _editorSet[index].resize();
                        },
                        301
                    );
                }
            }
        );
        Helper.waiting(false);
    };

    this.datasource = [];

    this.init = function (ECOM_MA_LEGO) {
        if (ECOM_MA_LEGO && ECOM_MA_LEGO.length) {
            this.datasource = ECOM_MA_LEGO;
            Helper.waiting(true);
            $.get(chrome.extension.getURL('../templateForSdk.html'), function (data) {
                var template = data;
                var tmpl = '';
                $.each(ECOM_MA_LEGO, function (index, editor) {
                    var temp = template.replace(/%legend%/, editor.templateName);
                    temp = temp.replace(/%index%/g, index);
                    if (index === ECOM_MA_LEGO.length - 1) {
                        temp = temp.replace(/%sdk\-fieldset\-last%/, ' sdk-fieldset-last');
                    }
                    else {
                        temp = temp.replace(/%sdk\-fieldset\-last%/, '');
                    }
                    tmpl += temp;
                });
                $('#sdk-tool-main').html(tmpl);

                $('.sdk-fieldset').each(function (index, element) {
                    var get = $(element).find('.sdk-get-value')[0];
                    var set = $(element).find('.sdk-set-value')[0];
                    var jsonEditorGet = new JSONEditor(
                        get,
                        {
                            mode: 'code',
                            indentation: 4
                        },
                        JSON.parse(ECOM_MA_LEGO[index].value)
                    );
                    $(element).find('.ace_text-input').attr('disabled', 'disabled');
                    var jsonEditorSet = new JSONEditor(set, { mode: 'code', indentation: 4 });
                    _editorGet.push(jsonEditorGet);
                    _editorSet.push(jsonEditorSet);
                });

                _bindEvents(ECOM_MA_LEGO);
            });
        }
        else {
            $('#sdk-tool-main').hide();
            $('#sdkNotFound').show();
            Helper.waiting(false);
        }
    };

    this.setValue = function (value, index) {
        _editorSet[index].setText(value);
    };
}

function materialPopup() {
    var _bindEvents = function () {

    };

    this.init = function (materials) {

    };
}

$(function() {
    $.get(chrome.extension.getURL('js/message.json'), function (message) {
        MESSAGE = JSON.parse(message);
        chrome.runtime.onMessage.addListener(function(request) {
            switch (request.code) {
                case MESSAGE.RECEIVE_MATERIALS:
                    if (request.materials && request.materials.length) {
                        popup = new materialPopup();
                        popup.init(request.materials);
                    }
                    break;

                case MESSAGE.RECEIVE_SDK_OBJECT:
                    if (request.ECOM_MA_LEGO) {
                        popup = new sdkPopup();
                        popup.init(request.ECOM_MA_LEGO);
                    }
                    break;

                case MESSAGE.RECEIVE_ERROR:
                    var errMsg = request.message;
                    var message = '';
                    if (request.message) {
                        var tokenErr = errMsg.indexOf('Unexpected token') > -1;
                        var endErr = errMsg.indexOf('Unexpected end of input') > -1;
                        if (tokenErr) {
                            message = '数据里边有非法字符：' + errMsg.slice('Unexpected token'.length + 1);
                        }
                        else if (endErr) {
                            message = '数据中存在没有闭合的`中括号`或者`花括号`';
                        }
                    }
                    Helper.showTip(message || '发生了一些错误，中国或成最大输家', true);
                    console.log(errMsg);
                    break;

                case MESSAGE.RECEIVE_SET_SUCCESS:
                    if (request.value) {
                        popup.setValue(request.value, request.index);
                    }
                    Helper.showTip('设置成功!');
                    break;

                default:
                    break;
            }
        });
        Helper.sendMessage({ code: MESSAGE.GET_SDK_OBJECT });
    });
});
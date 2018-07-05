

    $(window).load(function(){
      
// Chainable jQuery method to add range select functionality to an HTML table
// ToDo: support shift+select
// ToDo: disable text selection selectively
// ToDo: constrain to parent boundaries
$.fn.extend({
    selectable: function (options) {
        // Internal methods
        var defaults = {
            highlightClass: 'selected'
        };
		
        options = $.extend(defaults, options);
        var getOverlappingElements = function (overlay, rootElement) {
            return $(rootElement)
                .find('*')
                .filter(function () {
                var rect1 = this.getBoundingClientRect(),
                    rect2 = overlay.getBoundingClientRect();
                var overlap = !(rect1.right < rect2.left || rect1.left > rect2.right || rect1.bottom < rect2.top || rect1.top > rect2.bottom);
                return overlap;
            });
        }

        var getSelections = function (rootElement) {
            // Build delimited array from selections for paste
            var $elements = $(rootElement).find('td.' + options.highlightClass),
                selections = '';
            if (!$elements || !$elements.length) {
                return selections;
            }
            var firstRow = $elements[0].closest('tr').rowIndex,
                rowArray = [];
            for (var i = 0; i < $elements.length; i++) {
                var thisRowIndex = $elements[i].closest('tr').rowIndex - firstRow;
                if (!rowArray[thisRowIndex]) {
                    rowArray[thisRowIndex] = [];
                }
                var $visibleInputs = $($elements[i]).find('input:visible')
                var hasInput = $visibleInputs.length > 0;
                if (!hasInput) {
                    rowArray[thisRowIndex].push($elements[i].innerText);
                } else {
                    rowArray[thisRowIndex].push($visibleInputs[0].value);
                }
            }
            // Build delimited string from array
            for (var i = 0; i < rowArray.length; i++) {
                for (var j = 0; j < rowArray[i].length; j++) {
                    selections += rowArray[i][j];
                    if (j < rowArray[i].length - 1) {
                        selections += '\t';
                    }
                }
                if (i < rowArray.length - 1) {
                    selections += '\n';
                }
            }
            return selections;
        }

        var clearAll = function (rootElement) {
            $(rootElement).find('.' + options.highlightClass).removeClass(options.highlightClass);
        }

        var TrelloClipboard = function () {
            var me = this;

            var utils = {
                nodeName: function (node, name) {
                    return !!(node.nodeName.toLowerCase() === name)
                }
            }
            var textareaId = 'simulate-trello-clipboard',
                containerId = textareaId + '-container',
                container, textarea

            var createTextarea = function () {
                container = document.querySelector('#' + containerId)
                if (!container) {
                    container = document.createElement('div')
                    container.id = containerId
                    container.setAttribute('style', [, 'position: fixed;', 'left: 0px;', 'top: 0px;', 'width: 0px;', 'height: 0px;', 'z-index: 100;', 'opacity: 0;'].join(''))
                    document.body.appendChild(container)
                }
                container.style.display = 'block'
                textarea = document.createElement('textarea')
                textarea.setAttribute('style', [, 'width: 1px;', 'height: 1px;', 'padding: 0px;'].join(''))
                textarea.id = textareaId
                container.innerHTML = ''
                container.appendChild(textarea)

                textarea.appendChild(document.createTextNode(me.value))
                textarea.focus()
                textarea.select()
            }

            var keyDonwMonitor = function (e) {
                var code = e.keyCode || e.which;
                if (!(e.ctrlKey || e.metaKey)) {
                    return
                }
                var target = e.target
                if (utils.nodeName(target, 'textarea') || utils.nodeName(target, 'input')) {
                    return
                }
                if (window.getSelection && window.getSelection() && window.getSelection().toString()) {
                    return
                }
                if (document.selection && document.selection.createRange().text) {
                    return
                }
                setTimeout(createTextarea, 0)
            }

            var keyUpMonitor = function (e) {
                var code = e.keyCode || e.which;
                if (e.target.id !== textareaId) {
                    return
                }
                container.style.display = 'none'
            }

            document.addEventListener('keydown', keyDonwMonitor)
            document.addEventListener('keyup', keyUpMonitor)
        }

        TrelloClipboard.prototype.setValue = function (value) {
            this.value = value;
        }
        // End internal methods
        // Return chainable function, so calls like $('#myDiv).selectable() will work
        return $(this).each(function () {
            var $container = $(this),
                $selection = $('<div>').addClass('selectionbox');
            $container.on('mousedown', function (e) {
                // All bets are off if click target is an input or similar such, so just short-circuit.
                // This will keep features like select, cut, and paste
                // ... within the input working as expected.
                if ($(e.target).is(':input,textarea,a,button')) {
                    clearAll($container[0]);
                    return true;
                }
                // Globally preventing default will be problematic, and 
                // may cause components embedded in the control to fail to respond to click events
                // Instead, we attempt to suss intent in the mouseup handler
			
                var startY = e.pageY,
                    startX = e.pageX,
                    newX,
                    newY,
                    height,
                    width;

                $selection.css({
                    top: startY,
                    left: startX,
                    width: 0,
                    height: 0
                });

                $selection.appendTo($container);
                $container.on('mousemove', function (e) {
                    e.preventDefault();
                    var moveX = e.pageX,
                        moveY = e.pageY;

                    width = Math.abs(moveX - startX),
                    height = Math.abs(moveY - startY);
                    newX = (moveX < startX) ? (startX - width) : startX;
                    newY = (moveY < startY) ? (startY - height) : startY;

                    $selection.css({
                        width: width,
                        height: height,
                        top: newY,
                        left: newX
                    });
                }).one('mouseup', function (e) {
                    $container.off('mousemove');
                    var top = newY,
                        bottom = newY + height,
                        left = newX,
                        right = newX + width;
                    // distinguish between drag and click
                    if (Math.max(height, width) > 5) {
                        // Non-trivial movement, process event as drag
                        clearAll($container[0]);
                        var originalEvent = e.originalEvent;
                        if (originalEvent) {
                            originalEvent.preventDefault();
                        }
                        elements = getOverlappingElements($selection[0], $container[0])
                            .filter('td').addClass(options.highlightClass);
                        $selection.remove();
                    } else {
                        //// Minimal movement. Process as click. 
                        $selection.remove();
                        // The event target is actually the overlay. Get the element underneath to process click
                        var targetElement = document.elementFromPoint(e.clientX, e.clientY);
                        var $thisTd = $(targetElement).closest('td');
                        $(this).find('td').not($thisTd).removeClass(options.highlightClass);
                        $thisTd.toggleClass(options.highlightClass);
                        $(targetElement).click();
                    }
                    var selectionString = getSelections($container[0]);
                    if (selectionString) {
                        var clip = new TrelloClipboard();
                        clip.setValue(selectionString);
                    }
                });
            });
        });
    }
});

$('#myDiv').selectable();

    });


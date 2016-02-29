/*
 * ngWindow - Popup windows for angularjs
 * http://github.com/sojborg/ngWindow
 * (c) 2016 MIT License, sojborg
 */

(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        // CommonJS
        if (typeof angular === 'undefined') {
            factory(require('angular'));
        } else {
            factory(angular);
        }
        module.exports = 'ngWindow';
    } else if (typeof define === 'function' && define.amd) {
        // AMD
        define(['angular'], factory);
    } else {
        // Global Variables
        factory(root.angular);
    }
}(this, function (angular) {
    'use strict';

    var m = angular.module('ngWindow', []);

    var $el = angular.element;
    var openIdStack = [];
    var openMinimizedIdStack = [];


    m.provider('ngWindow', function () {
        
        this.$get = ['$document', '$templateCache', '$compile', '$q', '$http', '$rootScope', '$timeout', '$window', '$controller', '$injector',
            function ($document, $templateCache, $compile, $q, $http, $rootScope, $timeout, $window, $controller, $injector) {
                var $elements = [];

                var privateMethods = {
                    closeWindow: function ($window, value) {
                        
                    },

                    showWindow: function($window) {
                        $window.css({
                            display: 'block'
                        });
                    },

                    hideWindow: function ($window) {
                        $window.css({
                            display: 'none'
                        });
                    },

                    closeMinimize: function (minimizedId) {
                        var minimizedElement = document.getElementById(minimizedId);
                        var maximizeBtn = minimizedElement.getElementsByClassName("ngwindow-maximize-btn");
                        $el(maximizeBtn[0]).unbind('click');

                        var closeMinimizeBtn = minimizedElement.getElementsByClassName("ngwindow-close");
                        $el(closeMinimizeBtn).unbind('click');

                        var $minimized = $el(minimizedElement);
                        $minimized.remove();

                        openMinimizedIdStack.splice(openMinimizedIdStack.indexOf(minimizedId), 1);
                        privateMethods.rearrangeMinimizedElements();
                    },
                    
                    rearrangeMinimizedElements: function (){
                        var leftPosition = 0;
                        for(var i=0;i<openMinimizedIdStack.length; i++) {                            
                            var minimized = $el(document.getElementById(openMinimizedIdStack[i]));
                            var elementWidth = minimized[0].offsetWidth;
                            
                            minimized.css({
                                left: leftPosition+"px"
                            });
                            
                            leftPosition += elementWidth + privateMethods.getMarginBetweenMinimizedElements();
                        }
                    },
                    
                    getMarginBetweenMinimizedElements: function() {
                        return 25;
                    },
                    
                    isMoreMinimizedElementsPossible: function() {                        
                        var windowWidth = window.innerWidth;
                        var elementWidth = document.getElementsByClassName('ngwindow-minimized').length > 0 ? 
                                           document.getElementsByClassName('ngwindow-minimized')[0].offsetWidth : 0;
                                           
                        var currentLeftStartPosition = (elementWidth + privateMethods.getMarginBetweenMinimizedElements()) * openMinimizedIdStack.length;
                        
                        if ((currentLeftStartPosition+elementWidth) > windowWidth) {
                            alert("No more minimized is possible.");
                            return false;
                        }
                        return true;
                    },
                    
                    showMinimizedPreview: function(minimizedId, copiedPreviewContent, windowcontentwidth) {
                        var minimized = document.getElementById(minimizedId);
                        var minimizedStyle = window.getComputedStyle(minimized);
                        var minimizedLeftPosition = minimizedStyle.getPropertyValue('left');
                        var minimizedWidth = minimized.offsetWidth;
                        var minimizedHeight = minimized.offsetHeight;
                        var zoomlevel = ((minimizedWidth/windowcontentwidth)*100)/100;
                        
                        var previewContent = $el('<div>'+copiedPreviewContent+'</div>');
                        previewContent.css({
                            zoom: zoomlevel
                        });
                                                    
                        var preview = $el('<div id="'+minimizedId+'-preview" class="ngwindow-minimized-preview"></div>');
                        preview.css({
                            bottom: minimizedHeight  + 'px',
                            left: minimizedLeftPosition,
                            width: (minimizedWidth-10)+'px'
                        });
                        
                        preview.append(previewContent);
                        
                        var body = $el(document.body);
                        body.append(preview);
                    }
                };

                var publicMethods = {
                    __PRIVATE__: privateMethods,

                    open: function (opts) {
                        var windowId = null;
                        opts = opts || {};
                        if (openOnePerName && opts.name) {
                            windowId = opts.name+' window';
                            if (this.isOpen(windowId)) {
                                return;
                            }
                        }
                        var options = angular.copy(defaults);
                        var localID = ++globalID;
                        windowId = windowId || 'ngwindow' + localID;
                        openIdStack.push(windowId);

                        angular.extend(options, opts);

                        var defer;
                        defers[windowId] = defer = $q.defer();

                        var scope;
                        scopes[windowId] = scope = angular.isObject(options.scope) ? options.scope.$new() : $rootScope.$new();

                        var $window;

                        var resolve = angular.extend({}, options.resolve);

                        angular.forEach(resolve, function (value, key) {
                            resolve[key] = angular.isString(value) ? $injector.get(value) : $injector.invoke(value, null, null, key);
                        });

                        $q.all({
                            template: loadTemplate(options.template || options.templateUrl),
                            locals: $q.all(resolve)
                        }).then(function (setup) {
                            var template = setup.template,
                                locals = setup.locals;

                            if (options.showClose) {
                                template += '<div class="ngwindow-close"></div>';
                            }

                            if (options.showMinimize) {
                                template += '<div class="ngwindow-minimize-btn"></div>';
                            }

                            $window = $el('<div id="'+windowId + '" class="ngwindow"></div>');
                            $window.html(('<div class="ngwindow-content" role="document">' + template + '</div>'));

                            $window.data('$ngWindowOptions', options);

                            scope.ngWindowId = windowId;

                            windowsCount += 1;

                            return publicMethods;
                        });

                        return {
                            id: windowId,
                            closePromise: defer.promise,
                            close: function (value) {
                                privateMethods.closeWindow($window, value);
                            }
                        };
                    },
                    
                    close: function (id, value) {
                        var $window = $el(document.getElementById(id));

                        if ($window.length) {
                            privateMethods.closeWindow($window, value);
                        }

                        return publicMethods;
                    },

                    closeAll: function (value) {
                        var $all = document.querySelectorAll('.ngwindow');

                        // Reverse order to ensure focus restoration works as expected
                        for (var i = $all.length - 1; i >= 0; i--) {
                            var window = $all[i];
                            privateMethods.closeWindow($el(window), value);
                        }
                    },

                    minimize: function(id, minimizedTitle) {
                        if (!privateMethods.isMoreMinimizedElementsPossible())
                            return;
                        
                        var windowElement = document.getElementById(id);
                        var $window = $el(windowElement);
                        var minimizedId = id + '-minimized';                        
                        openMinimizedIdStack.push(minimizedId);
                        
                        // save the width of the window content before hiding it
                        var windowContentWidth = windowElement.getElementsByClassName('ngwindow-content')[0].offsetWidth

                        privateMethods.hideWindow($window);

                        var titleElement = $el('<div class="ngwindow-minimized-title">' + minimizedTitle + '<div>');
                        titleElement.bind('mouseover', function(event) {
                            var window = document.getElementById(id);
                            var copyWindowContent = window.getElementsByClassName('ngwindow-content')[0].innerHTML;
                                                        
                            privateMethods.showMinimizedPreview(minimizedId, copyWindowContent, windowContentWidth);
                        });
                        
                        titleElement.bind('mouseout', function(event) {                            
                            var mini = $el(document.getElementById(minimizedId+'-preview'));
                            mini.remove();
                        });

                        var maximizeButton = $el('<div class="ngwindow-maximize-btn"></div>');
                        maximizeButton.bind('click', function (event) {
                            privateMethods.closeMinimize(minimizedId);
                            privateMethods.showWindow($window);
                        });

                        var closeButton = $el('<div class="ngwindow-minimized-close"></div>');
                        closeButton.bind('click', function (event) {
                            privateMethods.closeWindow($window, '$closeButton');
                            privateMethods.closeMinimize(minimizedId);
                        });

                        var minimizedElement = $el('<div id="' + minimizedId + '" class="ngwindow-minimized"></div>');

                        minimizedElement.append(titleElement);
                        minimizedElement.append(maximizeButton);
                        minimizedElement.append(closeButton);
                        
                        $elements.body.append(minimizedElement);
                        privateMethods.rearrangeMinimizedElements();
                    },

                    getOpenWindows: function() {
                        return openIdStack;
                    },

                    getDefaults: function () {
                        return defaults;
                    }
                };

                angular.forEach(
                    ['html', 'body'],
                    function(elementName) {
                        $elements[elementName] = $document.find(elementName);
                        if (forceElementsReload[elementName]) {
                            var eventName = privateMethods.getRouterLocationEventName();
                            $rootScope.$on(eventName, function () {
                                $elements[elementName] = $document.find(elementName);
                            });
                        }
                    }
                );

                return publicMethods;
            }];
    });

    m.directive('ngWindow', ['ngWindow', function (ngWindow) {
        return {
            restrict: 'A',
            scope: {
                ngWindowScope: '='
            },
            link: function (scope, elem, attrs) {
                elem.on('click', function (e) {
                    e.preventDefault();

                    ngWindow.open({
                        template: attrs.ngWindow,
                        showMinimized: attrs.ngWindowShowMinimized === 'false' ? false : (attrs.ngWindowShowMinimized === 'true' ? true : defaults.showMinimized),
                        minimizedTitle: attrs.ngWindowMinimizedTitle
                    });
                });
            }
        };
    }]);

    return m;
}));

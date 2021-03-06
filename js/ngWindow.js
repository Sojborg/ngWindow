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
    var clickedWindowHandler;
    var defers = {};

    m.provider('ngWindow', function () {
        
        this.$get = ['$document', '$templateCache', '$compile', '$q', '$http', '$rootScope', '$timeout', '$window', '$controller', '$injector',
            function ($document, $templateCache, $compile, $q, $http, $rootScope, $timeout, $window, $controller, $injector) {
                var $elements = [];

                var privateMethods = {
                    closeWindow: function ($window, value, id) {
                        defers[id].resolve({
                           id: id,
                           value: value,
                           $window: $window 
                        });
                        delete defers[id];
                        $window.remove();
                    },
                    
                    windowClickedEvent: function(event, windowId) {
                        var isCloseButton = angular.element(event.target).hasClass('ngwindow-close');
                        var isMinimizeButton = angular.element(event.target).hasClass('ngwindow-minimize-btn');
                        
                        if (isCloseButton) {
                            publicMethods.close(windowId, 'testing');   
                        }                        
                        
                        if (isMinimizeButton) {
                            publicMethods.minimize(windowId, 'testing');
                        }       
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

                    open: function (options) {
                        
                        var template = loadTemplate(options.template);
                        var closeBtn = `<div class="ngwindow-close"></div>`;          
                        template += closeBtn;
                        
                        var minimizeBtn = `<div class="ngwindow-minimize-btn"></div>`;
                        template += minimizeBtn;
                        
                        var id = openIdStack.length+2;
                        var windowId = `ngWindow${id}`;     
                        openIdStack.push(windowId);
                        
                        var defer;
                        defers[windowId] = defer = $q.defer();                                                         

                        var $window = angular.element(`<div id="${windowId}" class="ngwindow"></div>`);
                        $window.html(('<div class="ngwindow-theme-default ngwindow-content" role="document">' + template + '</div>'));
                        
                        clickedWindowHandler = function(event) {
                            privateMethods.windowClickedEvent(event, $window.attr('id'));
                        }    
                        
                        $window.bind('click', clickedWindowHandler);                      
                        
                        $compile($window)(options.scope);
                        var body = $document.find('body');
                        body.append($window);  
                        
                        function loadTemplateUrl (tmpl, config) {
                            $rootScope.$broadcast('ngWindow.templateLoading', tmpl);
                            return $http.get(tmpl, (config || {})).then(function(res) {
                                $rootScope.$broadcast('ngWindow.templateLoaded', tmpl);
                                return res.data || '';
                            });
                        }

                        function loadTemplate (tmpl) {
                            if (!tmpl) {
                                return 'Empty template';
                            }

                            if (angular.isString(tmpl) && options.plain) {
                                return tmpl;
                            }

                            if (typeof options.cache === 'boolean' && !options.cache) {
                                return loadTemplateUrl(tmpl, {cache: false});
                            }

                            return loadTemplateUrl(tmpl, {cache: $templateCache});
                        }   
                                                    
                        var selected = null, 
                        x_pos = 0, y_pos = 0, 
                        x_elem = 0, y_elem = 0;

                        function _drag_init(elem) {
                            selected = elem;
                            x_elem = x_pos - selected.offsetLeft;
                            y_elem = y_pos - selected.offsetTop;
                        }
                        
                        var $body = angular.element(document.getElementById(windowId));                                         
                        $body.bind('mousemove', function(e) {      
                            x_pos = document.all ? window.event.clientX : e.pageX;
                            y_pos = document.all ? window.event.clientY : e.pageY;
                            var isWindow = angular.element(e.target).hasClass('ngwindow-content');
                            if (isWindow && selected !== null) {
                                selected.style.left = (x_pos - x_elem) + 'px';
                                selected.style.top = (y_pos - y_elem) + 'px';
                            }
                        });    
                        
                        $body.bind('mousedown', function(e) {                            
                            var isWindow = angular.element(e.target).hasClass('ngwindow-content');   
                                
                            if (isWindow) 
                                _drag_init(document.getElementById(windowId));
                        });
                        
                        $body.bind('mouseup', function(e) {         
                            selected = null;
                        });              
                        
                        return {
                            windowId: windowId,
                            closePromise: defer.promise                            
                        }
                    },
                    
                    close: function (id, value) {
                        var $window = $el(document.getElementById(id));                        

                        if ($window.length) {                            
                            privateMethods.closeWindow($window, value, id);
                            var removeIndex = openIdStack.indexOf(id);
                            openIdStack.splice(removeIndex, 1);
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
                            privateMethods.closeWindow($window, '$closeButton', id);
                            privateMethods.closeMinimize(minimizedId);
                        });

                        var minimizedElement = $el('<div id="' + minimizedId + '" class="ngwindow-minimized"></div>');

                        minimizedElement.append(titleElement);
                        minimizedElement.append(maximizeButton);
                        minimizedElement.append(closeButton);
                        
                        $document.find('body').append(minimizedElement);
                        privateMethods.rearrangeMinimizedElements();
                    },

                    getOpenWindows: function() {
                        return openIdStack;
                    },

                    getDefaults: function () {
                        return defaults;
                    }
                };

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

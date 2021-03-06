window.utils = function(utils){
	var MODULE_CB = [];
	var MODULE_MAP = {};
	var MODULE_PENDING = {};
	var CONTEXT_PATH = "/";
	var RESOURCE_PATH = "/res";
	
	utils.getAll = function(){
		return [MODULE_CB,MODULE_MAP,MODULE_PENDING]
	};
	
	/**
	 *  extendClass extends the Module from given parent Class name,
	 *  if parent Module name does not exists it will load the definition 
	 *  from server and if not found after that, it will throw an Exception.
	 *  
	 *  It can be extended (try again) from same module again. 
	 *  A module cannot be extended twice from same module, it will throw an Exception
	 *  while doing so.
	 *  
	 *  @param defObj
	 *  		Module to be extended
	 *  @param fromString
	 *  		Parent module name
	 */
	var extendClass = function(defObj,fromString,dummyProto){
		if(defObj._hasExtened_[fromString]) return defObj;
		if(!MODULE_MAP[fromString]){
			if(true && MODULE_PENDING[fromString]){
				MODULE_CB.push(function(){
					return extendClass(defObj,fromString,dummyProto);
				})
				defObj.waiting = true;
				return defObj;
			} else{
				defObj.waiting = false;
				utils.loadModule(fromString);
			}
		}
		if(MODULE_MAP[fromString] && MODULE_MAP[fromString]._define_){
			if(Object.setPrototypeOf){
				Object.setPrototypeOf(defObj, MODULE_MAP[fromString]);
			} else {
				if(MODULE_MAP[fromString]._parent_){
					extendClass(defObj,MODULE_MAP[fromString]._parent_,dummyProto);
				}
				MODULE_MAP[fromString]._define_(defObj,dummyProto);
			}
			defObj._hasExtened_[fromString] = true;
		} else {
			delete MODULE_MAP[fromString];
			throw new Error("parent module missing : " + fromString)	
		}
		return defObj;
	};
	
	var getPrototype = function(fromString){
		if(MODULE_MAP[fromString] && MODULE_MAP[fromString]._instance_){
			return MODULE_MAP[fromString].instance();
		} else {
			return new (function(){
				this.parent = function(fun){
					if(fun===undefined)
						return Object.getPrototypeOf(this);
					return Object.getPrototypeOf(this)[fun].bind(this);
				};
			});
		}
	}
	
	var getModule = function(classPath){
		return {
			module : classPath,
			_hasExtened_ : {},
			as : function(_define_){
				if(!this.hasOwnProperty('_define_') ){
					var self = this;
					this._define_ = _define_;
					//Prepraring Prototype
					var _protos_ = getPrototype(this._parent_);
					//console.info(utils.status.start(),"ASTART",this.module,this._parent_,_protos_)
					try	{
						if(this.parent()!==undefined && this.parent()._extend_){
							this.parent()._extend_(this,_protos_);
						} else {
							this._define_(this,_protos_);
						}
					} catch (e){
						console.warn(this.module,e);
					}
					this.proto_object = _protos_;
					this.proto_object.getClass = function(){
						return self;
					};
					if(false && typeof this._instance_ === 'function'){
						this._instance_.prototype = _protos_;
						//Additional Functions
						this._instance_.prototype.getClass = function(){
							return self;
						};
					}
					if(this._execute_) this._execute_();
					if(this.parent()!==undefined && this.parent()._extended_){
						this.parent()._extended_(this,this.proto_object);
					}
					if(this._ready_){
						utils.ready(function(){
							try{
								if(self._ready_) self._ready_();
							} catch (e){
								console.error(self.module+"._ready_:exception ",e);
							}
						});
					}
					//console.info(utils.status.done(),"ASDONE",this.module,this._parent_)
				} else {
					throw new Error("Module Definition" + this.module + 'already Exists ' 
							+ 'module can have only one definition')
				}
				return this;
			},
			extend : function(_parent_){
				if(!this._parent_){
					this._parent_ = _parent_;
					extendClass(this,this._parent_,{});
				}
				return this;
			},
			parent : function(){
				return MODULE_MAP[this._parent_];
			},
			instance : function(a,b,c,d,e,f,g,h){
				if(this._instance_){
					var __instance__ = this._instance_;
					try{
						var newInst = Object.create(this.proto_object);
						this._instance_.call(newInst,a,b,c,d,e,f,g,h);
						if(newInst._create_) newInst._create_();
						return newInst;
					} catch (e){
						console.error(this.module+"._instance_:exception ",e);
					}
				}
			},
			requires : function(){
				
			}
		};
	};
	
	utils.extend = function(fromString){
		return utils.define().extend(fromString);
	};
	
	utils.define = function(classPath,asFun){
		try{
			if(!classPath){
				/**
				 * If classPath is not given then 'anonymous' module should be created
				 * and returned to caller, it will not have
				 * any global identity, referring to it.
				 */
				return getModule('anonymous');
				
			} else if(typeof classPath=='string'){
				/**
				 * If classPath is given and is actually a package name then
				 * module is created in global namespace and returned to caller.
				 */
				if(!MODULE_MAP[classPath] || !MODULE_MAP[classPath]._define_) {
					var nspace = classPath.split('.');
					var win = window;
					var retspace = nspace[0];
					for(var i =0; i<nspace.length-1; i++){
						if (!win[nspace[i]]) win[nspace[i]] = {};
						retspace = nspace[i];
						win = win[retspace];
					}
					MODULE_MAP[classPath] = win[nspace[nspace.length-1]] = getModule(classPath);
				} //else throw new Error("Cannot redefine "+classPath + " as it already exists");
				if(MODULE_MAP[classPath] && asFun && typeof asFun == 'function'){
					MODULE_MAP[classPath].as(asFun);
				}
				return MODULE_MAP[classPath] ;
			} else if(typeof classPath=='function'){
				return getModule('anonymous').as(classPath);
			}
		} catch (e){
			console.error("e",e);
		}
	};
	
	var createPackList = function(pack,from,to){
		if(!from[pack]) return to;
		for(var i in from[pack]['@']){
			to = createPackList(from[pack]['@'][i],from,to);
		}
		if(to && from[pack]['files'] && from[pack]['files'].length)
			return to.concat(from[pack]['files']);
		else return to;
	};
	utils.resolvePack = utils.updateBundle = function(packs){
		return utils.files.update(packs);
	};
	utils.loadBundle = utils.loadPackage = function(pack){
		var pack_list = [];
		for(var i = 0; i < arguments.length; i++){
			if(!utils.files.BUNDLES[arguments[i]]){
				pack_list.push(arguments[i]);	
			}
		}
		if(pack_list.length){
			utils.files.loadJSFile('resources.json?cb=utils.updateBundle&$='
					+pack_list.join(','));
		}
		var files = [];
		for(var i = 0; i < arguments.length; i++){
			console.log("---",arguments[i],utils.files.BUNDLES[arguments[i]]);
			if(utils.files.BUNDLES[arguments[i]]){
				files = createPackList(arguments[i],utils.files.BUNDLES,files);	
			}
		}
		console.log("--",pack,files);
		utils.require.apply(this,files);
	};
	
	utils.module = function(classPath){
		if(!MODULE_MAP[classPath]){
			utils.require(classPath);
		}
		return MODULE_MAP[classPath];
	};
	
	utils.require = utils.loadModule = function(){
		var _mods_ = [], _bundles_ = [];
		for (var j = 0; j < arguments.length; j++){
			if(arguments[j]){
				if(arguments[j].indexOf(":")==0){
					_bundles_.push(arguments[j].substr(1));
				} else {
					_mods_.push(arguments[j])
				}
			}
		}
		if(_bundles_.length>0){
			var files = utils.loadBundle.apply(this,_bundles_);
		}
		var js_list = []; //Files to be fetched
		var mod_list = []; //Modules to be downloaded
		for (var j = 0; j < _mods_.length; j++) {
			var module = _mods_[j];
			if(!MODULE_MAP[module]){
				var p = utils.files.getInfo(module);
				MODULE_PENDING[p.module] = p.module;
				mod_list.push(p);
				js_list.push(p.url);
			}
		}
		var RETMODULE = [],_args = arguments;
		utils.files.loadFiles.call(utils.files,js_list,function(){
			for(var i in mod_list){
				delete MODULE_PENDING[mod_list[i].module];
			}
			var _MODULE_CB = MODULE_CB;
			MODULE_CB = []
			for(var i in _MODULE_CB){
				_MODULE_CB[i]();
	    	}
			for(var i in _args){
				RETMODULE.push(MODULE_MAP[_args[i]]);
			}
			for(var i in mod_list){
				if(!MODULE_MAP[mod_list[i].module]){
					console.warn(mod_list[i],'is not registered module');
				} else {
					MODULE_MAP[mod_list[i].module]._dir_ = mod_list[i].dir;
				}
			}
		});
		return RETMODULE;
	};

	utils.status = {
			me  : "=",
			start : function(){ var x =this.me; this.me+="="; return x;},
			done : function(){ this.me = this.me.replace('=','');return this.me;}
	}
	var _READY_ = [];
	utils.ready = function(cb){
		if(_READY_) return _READY_.push(cb);
		else return cb();
	};
	utils.ready(function(){
		var scripts = document.getElementsByTagName('script');
		for(var i=0; i<scripts.length;i++){
			if(!scripts[i].loaded){
				if(scripts[i].src && !scripts[i].getAttribute('loaded')){
					var p = utils.files.getInfo((scripts[i].src).replace(document.location.origin,''));
					var cleanSRC = p.url.replace(document.location.origin,'');
					utils.files.LOADED[cleanSRC] = cleanSRC
					MODULE_MAP[p.module] = MODULE_MAP[p.module] || (!MODULE_PENDING[p.module] ? {} : null);
					MODULE_MAP[p.module]._dir_ = p.dir;
				}
			}
		}
	});
	$(document).ready(function(){
		while(_READY_.length){
			_READY_[0](); _READY_.splice(0,1);
		} _READY_ = null;
	});
	utils.on_config_ready = function(){
		if(utils.config.bundle_list!==undefined) utils.files.loadJSFile(utils.config.bundle_list)
	};
	return utils;
}({});

utils.define('utils.config', function(config) {
	config.combine = true;
	var trimSlashes = function(str){
		return str.replace(/(^\/)|(\/$)/g, "");
	};
	config.ajaxPrefilter = function(options, originalOptions, jqXHR) {
		if (options.dataType == 'script' || originalOptions.dataType == 'script') {
			options.cache = true;
		}
	};
	config.set = function(options){
		CONTEXT_PATH = options.contextPath ? ("/"+trimSlashes(options.contextPath) + "/") : CONTEXT_PATH;
		RESOURCE_PATH =  (options.contextPath && options.resourcePath)
							? ('/' + trimSlashes(options.contextPath) 
									+ '/' +trimSlashes(options.resourcePath) + '/') 
							: RESOURCE_PATH;
		config.combine = (options.combine!=undefined) ? options.combine : config.combine;
		if(options.moduleDir){
			for(var reg in options.moduleDir){
				utils.files.DIR_MATCH[reg] = {
						reg : new RegExp(reg.replace('\.',"\\.",'g').replace('*','\\.*','g')),
						dir : options.moduleDir[reg]
				}
			}
		}
		options.contextPath = CONTEXT_PATH;
		delete options.moduleDir;
		for(var i in options){
			config[i]= options[i];
		}
		$.ajaxPrefilter(config.ajaxPrefilter);
		utils.on_config_ready();
	}
});

utils.define('utils.files', function(files) {
	var config = utils.config;
	files.MODULES = {};
	files.LOADED = {};
	files.BUNDLES = {};
    files.DIR_MATCH = {};
    
	files.update = function(packs){
		for(var pack in packs){
			if(!this.BUNDLES[pack]){
				this.BUNDLES[pack] = packs[pack];
				for(var i in this.BUNDLES[pack].files){
					var p = this.getInfo(this.BUNDLES[pack].files[i]);
					if(p && p.isJS){
						this.MODULES[p.module] = p;
					}
				}
			}
		}
	};
	
	files.dirMatch = function(module){
		for(var i in this.DIR_MATCH){
			if(this.DIR_MATCH[i].reg.test(module)){
				return this.DIR_MATCH[i].dir + module
			}
		} return module;
	}
    files.getInfo = function(path){
    	if(files.MODULES[path]) {
    		return files.MODULES[path];
    	}
    	var isJS = path.endsWith('.js');
    	var isCSS = path.endsWith('.css');
    	if(!isJS && !isCSS) {
    		path = path+'.js';
    		isJS = true;
    	}
    	var info = utils.url.info(path,utils.config.contextPath,utils.config.resourcePath);
    	var module = info.file.replace(/([\w]+)\.js$|.css$/, "$1");
    	var ext = isJS ? "js" : "css"
    	if(info.isFile){
    		info = utils.url.info(
    				files.dirMatch(module) + "." + ext,
    				utils.config.contextPath,utils.config.resourcePath);
    	}
    	info.isJS = isJS; info.isCSS = isCSS; info.ext = ext;
    	info.module = module;
    	files.MODULES[info.module] = info;
    	return info;
    };
    files.setResourcePath = function(path){
    	this.rpath = path;
    };
    files.loadJSFile = function(js){
        $('head').append('<script loaded=true src="' + js + '" type="text/javascript"></script>');
    };
    files.loadCSSFile = function(css){
        $('head').append('<link loaded=true href="' + css + '" type="text/css" rel=stylesheet></link>');
    };
    files.loadFiles = function() {
    	var args, jslist=[],csslist=[],cb;
    	if(typeof arguments[0] === 'string'){
    		args = arguments;
    	} else if($.isArray(arguments[0])){
    		args = arguments[0];
    		if(arguments[1] && typeof arguments[1]=='function'){
    			cb = arguments[1];
    		}
    	}
    	for (var j = 0; j < args.length; j++){
    		if(!files.LOADED[args[j]]){
    			if(args[j].endsWith('.css'))
    				csslist.push(args[j]);
    			else jslist.push(args[j]);
    		}
    	}
    	files.loadJs(jslist,cb);
    	files.loadCss(csslist,cb);
    };
    files.loadJs = function(list,cb){
    	if(config.combine && list.length){
    		$.ajax({
    			async: false,
    			url: RESOURCE_PATH + 'combine.js?@='+list.join(','),
    			dataType: "script",
    			cache : true,
    			complete : function(){
    				for(var i in list){
    					files.LOADED[list[i]] = list[i];
    				}
    				if(cb) cb();
    			}
    		});
    	} else {
    		for(var i in list){
    			files.loadJSFile(list[i]);
    			files.LOADED[list[i]] = list[i];
    		}
    		if(cb) cb();
    	} 
    };
    files.loadCss = function(list,cb){
    	if(config.combine && list.length){
    		$.ajax({
    			async: true,
    			url: RESOURCE_PATH + 'combine.css?@='+list.join(','),
    			complete : function(){
    				for(var i in list){
    					files.LOADED[list[i]] = list[i];
    				}
    				if(cb) cb();
    			}
    		});
    	} else {
    		for(var i in list){
    			files.loadCSSFile(list[i]);
    			files.LOADED[list[i]] = list[i];
    		}
    	} 
    };
});

utils.define('utils.url', function(url) {
	url.getParam = function (name,_url) {
	    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
	    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
	        results = regex.exec(_url || location.search);
	    return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
	};
	url.getValueAtIndex = function (index) {
		var data = window.location.pathname.split("/");
		return (data[index]);
	};
	url.push = function(pageData, pageTitle, pageUrl){
		return window.history.pushState(pageData || null, pageTitle || null, pageUrl);
	};
	url.info = function(_path,_context,_pwd){
		var path = url.resolve(_path,_context,_pwd);
		var info = { url : path };
    	var x = path.split('/');
    	info.isFile = (_path.split('/').length===1);
    	info.file = x.pop();
    	info.dir = x.join('/');
    	return info;
	};
	url.resolve = function(path,context,pwd){
		var context = context || ""; var pwd = pwd || "";
		if(path.indexOf('http://')==0 || path.indexOf('https://')==0)
			return  path;
		else if(path.indexOf('/')==0){
    		return url.clean(path);
    	} else {
    		return url.clean("/"+context + "/" + pwd + "/" + path);
    	}
	};
	url.clean = function(url){
		var ars = url.split('/');
		var domain = ars.shift();
		var parents = [];
		for( var i in ars) {
		    switch(ars[i]) {
		        case '.':
		        // Don't need to do anything here
		        break;
		        case '..':
		        	parents.pop()
		        break;
		        default:
		        	parents.push(ars[i]);
		        break;
		    }
		}
		return (domain +  '/'  + parents.join( '/')).replace(/(\/)+/g,'/');
	};
});

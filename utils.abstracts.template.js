utils.define('utils.abstracts.template', function(template,_instance_) {
	var custom = utils.require('utils.custom');
	var odo = utils.require('utils.odo');
	var tag = utils.require('utils.custom.tag');
	var _template = utils.require('utils.template');

	var DATA_PATH = 'data-path';
	var DATA_ONCHANGE = 'data-onchange';
	var DATA_FORMAT = 'data-format';
	
	template._instance_ = function(obj){
		if(!obj) return;
		template._create_template_(this,obj);
	};
	template._create_template_ = function(THIS,obj){
		THIS.name = this.module;
		THIS.data = odo.instance();
		var data = obj.data || {};
		delete obj.data;
		for(var prop in obj){
			THIS[prop] =  obj[prop];
		}
		return _template.loadHTML(THIS,function(){
			THIS._bindDomEvents_();
			THIS._bindDataEvents_();
			THIS.data.update(data);
			if(THIS._ready_) THIS._ready_();
		});
	};
	_instance_._bindDomEvents_ = function(){
		if(this.$div){
			var THAT = this;
			THAT.$div.on('TagOnChange',function(e){
				var $tag = $(e.target);
				if(!$tag.hasClass('disabled')){
					var detail = custom.getEventDetail(e);
					detail.fieldType =  $tag.attr('name') || $tag.attr('fieldType');
					detail.path = $tag.attr(DATA_PATH);
					detail.change = $tag.attr(DATA_ONCHANGE);
					var value = $tag.getValue();
					THAT.data.change(detail.path,value);
					THAT._onchange_(detail.path,value);
				}
			});
		}
	};
	_instance_._bindDataEvents_ = function(){
		if(this.data){
			var THAT = this;
			THAT.data.sub('*',function(dEvent, b, c, e, THIS){
				var elem, _value, isTag;
				if(dEvent.value && dEvent.value._tag_){
					 isTag = true;
				}
				$("[" + DATA_PATH + "='"+dEvent.path+"']", THAT.$div).each(function() {
					var $tag = $(this), param = $tag.attr(DATA_PATH);
					if($tag.hasClass('tag')){
						if(isTag) $tag.setData(dEvent.value);
						else $tag.setValue(dEvent.value);
					} else {
						var formatter = $tag.attr(DATA_FORMAT);
						if(formatter && THAT[formatter]){
							var __value = THAT[formatter](_value,$tag)
							if(__value!==undefined){
								_value = __value;
							}
						}
						var text = isTag ? dEvent.value.value : dEvent.value;
						$tag.setValue(text);	
					}
				});
				THAT._datachange_(dEvent,b,c,e,THIS);
			});
		}
	};
	
	// Properties per template instance
	_instance_.update = function(dData){
		return this.data.update(dData);
	};
	_instance_._onchange_ = function(dPath,dValue){
		return null;
	};
	_instance_._datachange_ = function(dPath,dValue){
		return null;
	};
	_instance_.sub = function(dPath,listner){
		if(dPath=='*') return this._datachange_ = listner;
		return this.data.sub(dPath,listner);
	};
	_instance_.on = function(dPath,dPathListner,listner){
		if(dPath=='DataChange'){
			return this.sub(dPath,listner);
		} else {
			return this.$div.on(dPath, dPathListner,listner);
		}
	};
	_instance_.onReady = function(_ready_){
		this._ready_ = _ready_; return this;
	};
});
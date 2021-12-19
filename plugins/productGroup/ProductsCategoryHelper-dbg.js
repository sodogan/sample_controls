/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["retail/pmr/promotionaloffers/utils/Utils"], function(Utils){
	
	
	var ProductsCategoryHelper = function(masterDataSystem,includes,excludes){
		
		this.masterDataSystem = masterDataSystem;
		this.includes = includes || [];
		this.excludes = excludes || [];
		
		this.getPayload = function(){
			this.generatePayload();
			
			return this.payload;
		};
		
		this.getHierarchy = function(IsPreview,IsInclude){
			this.buildHierarchy(IsPreview,IsInclude);
			
			return this.hierarchy;
		};
		
		this.setMasterData = function(masterdataSystem){
			this.masterDataSystem = masterdataSystem;
		};
		
		this.formatedNode = function(dimension,	groupId, number, sign, item){
			
			var referenceId = item.Id || item.ReferenceId;
			
			return {
				Dimension: dimension,
				GroupId: groupId, 
				Number: number, 
				ReferenceId: referenceId, 
				Sign: sign
			};
		};
		
		this.setIncludes = function(includes,replaceExisting){
			if(this.includes.length === 0 || replaceExisting){				
				this.includes = [];				
				for(var z = 0, zLen = includes.length; z < zLen; z++){
					if(includes[z].Dimension === "03" || typeof includes[z].Dimension === "undefined"){
						var node = this.formatedNode("03", undefined, this.includes.length + 1, "I", includes[z]);
						this.includes.push(node);	
					}
				}				
			}else{
				for(var i = 0, iLen = includes.length; i < iLen; i++){
					if(!this.isDuplicateDeep(this.includes,includes[i])){		
						var node = this.formatedNode("03",this.includes[0].GroupId,this.includes.length + 1,"I",includes[i]);
						this.includes.push(node);						
					}
				}
			}
		};
		
		this.setExcludes = function(excludes,replaceExisting){
			if(this.excludes.length === 0 || replaceExisting){
				this.excludes = [];
				for(var z = 0, zLen = excludes.length; z < zLen; z++){
					if(excludes[z].Dimension === "03" || typeof excludes[z].Dimension === "undefined"){
						var node = this.formatedNode("03", undefined, this.excludes.length + 1, "E", excludes[z]);
						this.excludes.push(node);	
					}
				}
			}else{
				for(var i = 0, iLen = excludes.length; i < iLen; i++){
					if(!this.isDuplicateDeep(this.excludes,excludes[i])){	
						var node = this.formatedNode("03",this.excludes[0].GroupId,this.excludes.length + 1,"E",excludes[i]);
						this.excludes.push(node);						
					}
				}
			}
		};
		
		this.setProductsCategory = function(data){
			this.result = data;
		};
		
		this.getExcludedProducts = function(){	
			var excludedHierarchies = [];
			var hierarchy = this.getHierarchy();
			
			var findExcludedHierarchy = function(item){
				if(item.children && item.children){
					for(var i = 0, iLen = item.children.length; i < iLen; i++){
						if(!item.children[i].isIncluded){
							excludedHierarchies.push(item.children[i]);
						}else{
							findExcludedHierarchy(item.children[i]);
						}
					}
				}
			};
			
			if(hierarchy && hierarchy.length > 0){
				for(var i = 0, iLen = hierarchy.length; i < iLen; i++){
					if(!hierarchy[i].isIncluded){
						excludedHierarchies.push(hierarchy[i]);
					}else{
						findExcludedHierarchy(hierarchy[i]);
					}
				}
			}
			
			return excludedHierarchies;
		};
		
		this.slimData = function(arry,isInclude){
   			var items = jQuery.extend([],arry);
   			var toReturn = [];
   			for(var i = 0, iLen = items.length; i < iLen; i++){
   				var item = {};
   				item.ReferenceId = items[i].Id;
   				item.Dimension = items[i].Dimension;
   				item.Sign = isInclude ? "I" : "E";
   				
   				toReturn.push(item);
   			}
   			
   			return toReturn;
   		};
   		
   		this.isDuplicateDeep = function(existing,item){
   			var found = false;
   			var that = this;
   			
   			var checkDuplicate = function() {
   				for(var j = 0, jLen = existing.length; j < jLen; j++){
   					if(existing[j].ReferenceId === item.Id){
   						found = true;
   						break;
   					}
   				}
   			};
   			
   			var checkChildOf = function(items,id){
   				for(var i = 0, iLen = items.length; i < iLen; i++){
   					if(items[i].Id === id){
   						found = true;
   						break;
   					}else{
   						if(items[i].children){
   							checkChildOf(items[i].children,id);
   						}
   					}
   				}
   			};

   			checkDuplicate();
   			
   			if(!found){   				
   				checkChildOf(that.hierarchy,item.ParentId);
   			}
   			
   			return found;

   		};
	};
	
	ProductsCategoryHelper.prototype.generatePayload = function(){
		var rules = [];	
		for(var i = 0, iLen = this.includes.length; i < iLen; i++){
			var refId = this.includes[i].ReferenceId || this.includes[i].Id;
			var rule = {
					GroupId : "1",
					Number: (i + 1) + "",
					Sign: "I",
					Dimension: "03",
					ReferenceId: refId
			};
			
			rules.push(rule);
		}
		
		for(var j = 0, jLen = this.excludes.length; j < jLen; j++){
			var refId = this.excludes[j].ReferenceId || this.excludes[j].Id;
			var rule = {
					GroupId : "1",
					Number: (i) + (j + 1) + "",
					Sign: "E",
					Dimension: "03",
					ReferenceId: refId
			};
			
			rules.push(rule);
		}
		
		
		this.payload = {
				Id: "1",
				MasterdataSystem : this.masterDataSystem,
				Rules: rules,
				Nodes:[],
				Included: [],
				Excluded: []
		};
	};
	ProductsCategoryHelper.prototype.buildHierarchy = function(IsPreview,IsInclude){	
		var that = this;
		
		if(!this.result){
			this.hierarchy = [];
			return;
		}
		
		var nodes = this.result.Nodes ? this.result.Nodes.results || this.result.Nodes : [];
		if (IsPreview) {
			nodes = this.result.HierarchyPreview ? this.result.HierarchyPreview.results || this.result.HierarchyPreview : [];
		}
		var rules = this.result.Rules ? this.result.Rules.results : [];
		var filters = this.result.Filters ? this.result.Filters.results : [];
		
		var extendedProducts = [];
		
		var nodeWithInfo = function(node,isIncluded){
			var item = jQuery.extend({},node);
			item.virtualParentId = item.ParentId;
			delete item.__metadata;
			item.isIncluded = isIncluded;
			item.Filters = [];
			
			return item;
		};
		
		var extendNodesWithInfo = function(){
			for(var i = 0, iLen = nodes.length; i < iLen; i++){
				if(nodes[i].Dimension === "03"){
					extendedProducts.push(nodeWithInfo(nodes[i],true));
				}
			}
			
			for(var j = 0, jLen = rules.length; j < jLen; j++){
				for(var z = 0, zLen = extendedProducts.length; z < zLen; z++){
					if(rules[j].Dimension === "03" && rules[j].ReferenceId === extendedProducts[z].Id){
						//mark as excluded
						var isIncluded = rules[j].Sign.indexOf("I") > -1 ? true : false;
						extendedProducts[z].isIncluded = isIncluded;
					}
				}
			}
		};

		var ruleNodes = [];
		var getRuleNodes = function(){
			for(var i = 0,iLen = rules.length; i < iLen; i++){
				for(var j = 0, jLen = extendedProducts.length; j < jLen; j++){
					if(rules[i].ReferenceId === extendedProducts[j].Id){
						extendedProducts[j].hasParent = false;
						ruleNodes.push(extendedProducts[j]);
					}
				}																							
			}							
		};
								
		var markRuleNodes = function(){
			for(var i = 0, iLen = ruleNodes.length; i < iLen; i++){								
				for(var j = 0,jLen = ruleNodes.length; j < jLen; j++){
					if(ruleNodes[i].ParentId === ruleNodes[j].Id){
						ruleNodes[i].hasParent = true;
					}
				}
			}
		};
		
		var markParents = function(){
			for(var i = 0, iLen = ruleNodes.length; i < iLen; i++){								
				if(!ruleNodes[i].hasParent){
					ruleNodes[i].virtualParentId = "AAAAAAAAAAAAAAAAAAAAAA==";
				}																							
			}
		};
		
		var markExcluded = function(items){
			var markChildrenExcluded = function(items){
				for(var i = 0, iLen = items.length; i < iLen; i++){	
					items[i].isIncluded = false;
					if(items[i].children && items[i].children.length > 0){
						markChildrenExcluded(items[i].children);
					}
				}
			};
			
			var findNode = function(id,items){
				for(var i = 0, iLen = items.length; i < iLen; i++){	
					if(items[i].Id === id && items[i].children){
						markChildrenExcluded(items[i].children);
						break;
					}else{
						if(items[i].children && items[i].children.length > 0){
							findNode(id,items[i].children);
						}						
					}
				}
			};
			
			for(var i = 0, iLen = items.length; i < iLen; i++){	
				if(items[i].Sign === "E"){
					findNode(items[i].ReferenceId,that.hierarchy);
				}
			}
		};
		
		var hideTopExcludedNode = function(){
			for(var i = that.hierarchy.length - 1, iLen = 0; i >= iLen; i--){
				if(that.hierarchy[i].isIncluded === false && Utils.isInitial(that.hierarchy[i].ParentId)){
					that.hierarchy.splice(i,1);
				}
			}
		};
		
		var addFiltersToProducts = function(){
			if(filters && filters.length > 0){
				filters.forEach(function(filter){
					extendedProducts.forEach(function(product){
						if(product.Id === filter.NodeId){
							delete filter.__metadata;
							product.Filters.push(filter);
						}
					});
				});
			}
		};
		var stringifyFilters = function(){
			if(extendedProducts && extendedProducts.length > 0){
				extendedProducts.forEach(function(product){
					product.Filters = JSON.stringify(product.Filters);
				});
			}			
		};
		extendNodesWithInfo();
		
		//get parent nodes
		getRuleNodes();
		markRuleNodes();
		markParents();
		addFiltersToProducts();
		stringifyFilters();
		
		//get hierarchy
		this.hierarchy = Utils.buildHierarchy(extendedProducts);
		if (!IsPreview) {
			markExcluded(rules);
		}	
		
		if(IsInclude){
			hideTopExcludedNode();
		}
	};
	ProductsCategoryHelper.prototype.markFilterModified = function(hierarchy,filters){
		var markModified = function(id,items){
			for(var i=0,iLen=items.length;i<iLen;i++){
				var filters = JSON.parse(items[i].Filters);
				if(items[i].Id === id && filters && filters.length > 0){
					items[i].filterModified = true;
					break;
				}else if(items[i].children && items[i].children.length > 0){
					markModified(id,items[i].children);
				}
			}
		};
		
		
		for(var id in filters){
			markModified(id,hierarchy);
		}
				
	};
	ProductsCategoryHelper.prototype.getSelectedItems = function(e) {
		var table = e.getSource().getTable();
		var items = [];
		var params = e.getParameter("tableSelectionParams");
		if (params.selectAll) {
			params.rowIndices.forEach(function(index) {
				var context = table.getContextByIndex(index);
				if (context) {
					var object = context.getObject();
					items.push(object);
				}
			}.bind(this)); 
		} else {
			var item = e.getParameter("tableSelectionParams").rowContext.getObject();
			items.push(item);
		}	
		return items;
	};
	ProductsCategoryHelper.prototype.removeIncludeNode = function(id){
		if(this.includes && this.includes.length > 0){
			for(var z = this.includes.length - 1, zLen = 0; z >= zLen; z--){   	   			
   				if(id === this.includes[z].ReferenceId){
   					this.includes.splice(z,1);	   					
   					break;
   				}
   	   		}
		}
	};
	return ProductsCategoryHelper;
}, true);
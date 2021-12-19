/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([], function(){
	
	function DynamicFilterController(hierarchy){
		this.hierarchy = hierarchy;
		this.stores = traverse(this.hierarchy);
	}

	function hasChildren(node){
		for(var key in node){
			if(node.hasOwnProperty(key) && jQuery.isNumeric(key)){
				return true;
			}
		}
		return false;
	}
	
	function traverse(hierarchy, result){
		result = result || [];
		for(var key in hierarchy){
			if(hierarchy.hasOwnProperty(key) && jQuery.isNumeric(key)){
				var currentSubNode = hierarchy[key];				
				traverse(currentSubNode, result);				
				if(!currentSubNode.HierarchyId && !hasChildren(currentSubNode)){
					result.push(currentSubNode);	
				}				
			}
		}			
		return result;
	}

	DynamicFilterController.prototype.getStores = function(){		
		return this.stores;
	};
	
	DynamicFilterController.prototype.getSelectedStoresCount = function(){
		return this.stores.filter(function (s){
			return s.checked;
		}).length;
	};
	
	return DynamicFilterController;
}, true);
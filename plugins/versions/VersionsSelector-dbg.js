/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["sap/ui/model/json/JSONModel",
               "retail/pmr/promotionaloffers/utils/Utils",
               "retail/pmr/promotionaloffers/plugins/general/LocationSelector"], 
	function(JSONModel,Utils,LocationSelector){
		
	function appendVersions(id, items, versionName){
		if(id === items.LocationId || id === items.NodeId || id === items.ExtNodeId){
			items.hasVersion = true;
			items.VersionName = versionName;
		}else{
			for(var i in items){
				if(items.hasOwnProperty(i) && jQuery.isNumeric(i)){
					appendVersions(id, items[i], versionName);
				}
			}
		}
	}
	
	function versionsCount(items){
		var count = 0;
		items.showTooltip = true;
		if(items.NodeId || items.LocationId || items.ExtNodeId){
			
			//initial node starts from 1
			count = 0;
			versionCount(items,count);
			if(count > 0){
				items.versionCount = count;
			}							
		}
		
		for(var i in items){
			if(items.hasOwnProperty(i) && jQuery.isNumeric(i)){
				versionsCount(items[i]);
			}
		}
		
		function versionCount(items){
			if(items.hasVersion){
				count++;
			}

			for(var i in items){
				if(items.hasOwnProperty(i) && jQuery.isNumeric(i)){
					versionCount(items[i]);
					items.showTooltip = false;
				}
			}					
		}
	}
	
	function VersionsSelector(table,locationHierarchy,i18nModel,versions,excluded,selectedLocations){
		this.table = table;
		var hierarchy = jQuery.extend({}, locationHierarchy);
		this.versionsCount = 0;
//		resetHierarchy(hierarchy);		
	
		//set model for tree
		this.setTreeTableData(hierarchy, versions);
		
		//set model for i18n
		this.table.setModel(i18nModel, "i18n");
		
		this.selected = [];
		this.isCombine = true;
		if (selectedLocations && selectedLocations.length > 0) {
			this.selected = selectedLocations;
			this.isCombine = false;
		}
		this.expanding = false;	
		
	}
	VersionsSelector.prototype = Object.create(LocationSelector.prototype);
	
	VersionsSelector.prototype.setTreeTableData = function(hierarchy, versions){
		this.hierarchy = hierarchy;
		//append versions
		if(versions){
			for(var i = 0, iLen = versions.length; i < iLen; i++){
				var id = versions[i].LocationId || versions[i].LocationNodeId || versions[i].NodeId || versions[i].ExtLocationNodeId;
				appendVersions(id, hierarchy, versions[i].Name);
			}
		}	
		//calculate no versions
		versionsCount(hierarchy);
		this.data = [];
		this.flattenTree(this.data,hierarchy);
		this.treeModel = new JSONModel(hierarchy);
		this.table.setModel(this.treeModel);
	};
	
	VersionsSelector.prototype.getCurrentHierarchy = function(){
		return this.hierarchy;
	};
	
	VersionsSelector.prototype.setVHDialog = function(vhDialog,offerInterval){
		this.vhDialog = vhDialog;
		this.vhDialog.setHandleRemoveAllSelectedBtn(this.handleRemoveAllSelected.bind(this));
		this.addToken();
		this.offerInterval = offerInterval;
	};

	VersionsSelector.prototype.handleRemoveAllSelected = function(oEvent) {
		if (oEvent.constructor === Array) {
			var locationId = this.selected[0].LocationId || this.selected[0].NodeId;
			this.selected = [];	
			var items = this.treeModel.getData();
			var rows = this.flattenItems(items);
			this.expandParent(this.treeModel, locationId);
			for(var i = 0; i < rows.length; i++){
				if(rows[i].checked) {
					rows[i].checked = false;
				}
			}
			this.table.clearSelection();
			return;
		}
		var token = oEvent.getParameters().token;
		if (this.selected && this.selected.length > 0) {
			for (var i = 0; i < this.selected.length; i++) {
				var locationId = this.selected[i].LocationId || this.selected[i].NodeId;
				var tokenKey = token.getKey();
				if (locationId === tokenKey) {
					this.expandParent(this.treeModel, locationId);
					var unSelectedItem = this.getObject(this.treeModel, locationId);
					this.selectionLogic(unSelectedItem);	
					this.removeTokenId = locationId;
					this.isDeleteToken = true;
					break;
				}
			}
			this.renderSelections(this.table, this.treeModel);
			this.isDeleteToken = false;
			this.removeTokenId = null;	
		}		
	};
	
	VersionsSelector.prototype.expandParent = function(model, locationId) {
		var items = model.getData();
		var rows = this.flattenItems(items);
		var objectParent = null;
		var getParent = function(hierarchy) {
			if (hierarchy && hierarchy.LocationIds 
					&& hierarchy.LocationIds.split(";").indexOf(locationId) !== -1) {
				objectParent = hierarchy;

			}
			if (!objectParent) {
				for (var key in hierarchy) {
					if(hierarchy.hasOwnProperty(key) && jQuery.isNumeric(key)){
						getParent(hierarchy[key]);		
					}
				}
			}	
		};
		getParent(this.hierarchy);
		
		for(var i = 0; i < rows.length; i++){
			var currentRow = rows[i];
			var rowLocation = currentRow.LocationId || currentRow.NodeId;
			if (objectParent) {
				var parentLocation = objectParent.NodeId;
				if(parentLocation === rowLocation){
					currentRow.expanded = true;
					this.table.expand(i);
					this.table.expand(i);
				}
			}
		}	
	};
	
	VersionsSelector.prototype.getObject = function(model, locationId) {
		var items = model.getData();
		var rows = this.flattenItems(items);
		
		for(var i = 0; i < rows.length; i++){
			var currentRow = rows[i];
			var rowLocation = currentRow.LocationId || currentRow.NodeId;
			if(locationId === rowLocation){
				return currentRow;
			}
		}				
		
	};
	
	VersionsSelector.prototype.selectionLogic = function(object){
		var that = this;
		var isSameType = true;
		var isSameLevel = true;
		var isHierarchy = false;
		var isUserCreated = false;
		
		var noVersion = function(){
			if(object.hasVersion){
				return false;
			}				
			
			return true;
		};
		
		var excludedNode = function(){
			if(object.excluded){
				return false;
			}
			
			return true;
		};
		
		var getType = function(item){
			if(item.hasOwnProperty("NodeId") && item.NodeId){
				return true;
			}
			
			return false;
		};

		var sameType = function(items,type){
			if(items.checked){
				if(getType(items) !== type){
					isSameType = false;					
				}
			}
			
			if(isSameType){
				for(var i in items){
					if(items.hasOwnProperty(i) && jQuery.isNumeric(i)){
						sameType(items[i],type);
					}
				}
			}
		};
		
		var sameLevel = function(parentID,items){
			for(var i = 0, iLen = items.length; i < iLen; i++){
				if(parentID !== items[i].ParentId){
					isSameLevel = false;
					break;
				}
			}
		};
		
		var removeSelected = function(obj){
			that.selected = that.selected.filter(function(item){
				var id = item.NodeId || item.LocationId;
				return !(obj.NodeId === id || obj.LocationId === id);
			});
		};
		
		var nodeChecked = function(){
			if(!noVersion()) {
				return;
			}
			
			if(!excludedNode()) {
				return;
			}
			
			var parentOfChild = getParentFromChild();
			if((object.userCreatedNode && !object.isChild && !object.isParent) 
					|| (parentOfChild && parentOfChild.userCreatedNode && that.isCombine)) {
				return;
			}
			
			if (that.isDeleteToken) {
				return;
			}
			
			isHierarchy = getType(object);
			var hierarchy = that.vhDialog.getTable().getModel().getData();
			
			sameType(hierarchy[0],isHierarchy);
			
			if(isSameType){				
				sameLevel(object.ParentId,that.selected);
				
				if(isSameLevel) {
					var items = that.hierarchy;
					var rows = that.flattenItems(items);
					var notSel = rows.filter(function(item){
						return !item.checked && !item.versionCount && !item.userCreatedNode;
					});
					if(notSel.length > 1) {
						object.checked = true;
						if (!object.isParent) {
							that.selected.push(object);
						}	
					}
				}
			}
			toggleUserCreateNode();
			that.addToken();
		};
		
		var nodeUnchecked = function(){
			var objId = object.NodeId || object.LocationId;
			if (that.isDeleteToken && objId !== that.removeTokenId) {
				return;
			}
			object.checked = false;	
			object.hasVersion = false;
			removeSelected(object);
			toggleUserCreateNode();
			that.addToken();
		};
		
		var toggleChildren = function(obj){
			for(var i in obj){
				if (obj.hasOwnProperty(i) && jQuery.isNumeric(i)){
					that.select(obj[i], obj[i].excluded ? false : obj.checked);
					toggleChildren(obj[i]);
					if (obj.checked) {
						that.selected.push(obj[i]);
					} else {
						removeSelected(obj[i]);
					}
				}
			}
		};
		
		var toggleUserCreateNode = function() {
			
			if (object.isParent) {
				toggleChildren(object);
			}
			if (object.isChild) {
				var parent = getParentFromChild();
				if (parent) {
					if (getNumberOfChildrenSelected(parent) > 1) {
						that.select(parent, true);
					} else {
						that.select(parent, false);
					}
				}
			}
		};
		
		var getChildrenInTree = function(obj){
			var toReturn = [];
			for(var index in obj){
				if(obj.hasOwnProperty(index) && jQuery.isNumeric(index)){
					toReturn.push(obj[index]);
				}
			}
			
			return toReturn;
		};
		
		var getNumberOfChildrenSelected = function(obj) {
			var numberToReturn = 0;
			var allChildrens = getChildrenInTree(obj);
			for (var i = 0; i < allChildrens.length; i++) {
				if (allChildrens[i].checked || allChildrens[i].excluded) {
					numberToReturn++;
				}
			}
			return numberToReturn;
		};
		
		var getParentFromChild = function() {
			var objectParent = null;
			var getParent = function(hierarchy) {
				if (hierarchy && hierarchy.LocationIds 
						&& hierarchy.LocationIds.split(";").indexOf(object.LocationId || object.NodeId) !== -1) {
					objectParent = hierarchy;

				}
				if (!objectParent) {
					for (var key in hierarchy) {
						if(hierarchy.hasOwnProperty(key) && jQuery.isNumeric(key)){
							getParent(hierarchy[key]);		
						}
					}
				}	
			};
			getParent(that.hierarchy);
			return objectParent;
		};				
		
		var selection = {
		  	"true": nodeChecked,
		    "false": nodeUnchecked
		};
		
		selection[!object.checked]();
	};
	
	VersionsSelector.prototype.select = function(item, selected){
		item.checked = selected;
	};
	
	VersionsSelector.prototype.addToken = function() {
		var token = [];
		if(this.vhDialog){
			this.vhDialog.removeAllSelectedTokens();	
			if (this.selected && this.selected.length > 0) {
				for (var i = 0; i < this.selected.length; i++) {
					var item = this.selected[i];
					var tokenKey = item.LocationId || item.NodeId;
					var id = item.ExtNodeId || item.ExtLocationId; 
					var display = id; 
					if (item.Name) {
						display = item.Name + " (" + id + ")";
					}
					var newToken = new sap.m.Token({key: tokenKey, text:display});  
					token.push(newToken);
					this.vhDialog.setTokens(token);	
				}
				this.removeDuplicates();
			}
		}
								
	};
	
	VersionsSelector.prototype.removeDuplicates = function(){
		if (this.selected && this.selected.length > 1) {
			var duplicatesTokens = [];
			var nrOfElements = this.selected.length - 1;
			
			for (var i = 0; i < nrOfElements; i++) {
				for (var j = 0; j < i + 1; j++) {
					var tokenKey = this.selected[j].LocationId || this.selected[j].NodeId;
					duplicatesTokens.push(tokenKey);
					this.vhDialog.removeToken(tokenKey);
				}
			}	
		}	
	};
	
	VersionsSelector.prototype.clearSelection = function(){
		var that = this;
		var treeTable = that.vhDialog.getTable();
		var clearAllSelected = function(treeTable) {
	    	    var index = 0;
	    	    do {
	    	      var context = treeTable.getContextByIndex(index);
	    	      if (!context) {
	    	    	  continue;
	    	      }
	    	      var object = context.getObject();
	    	    	  object.checked = false;
	    	    	  object.extended = false;
	    	      if (object.NodeId !== ""
	    	    	  || (object.userCreatedNode && object.ExtNodeId !== "")) {
	    	    	  treeTable.expand(index);  
	    	    	  treeTable.expand(index); 
	    	      }
	    	      index++;
	    	    } while (context);
	    	    treeTable.collapseAll();
	     };
	     clearAllSelected(treeTable);
	};
	
	VersionsSelector.prototype.getSelected = function(){
		return this.selected;
	};
	
	VersionsSelector.prototype.getParentItem = function(item){
		var that = this;
		var parent = null;
		
		var getParent = function(items){
			if(items.NodeId === item.ParentId){
				parent = items;
			}else{
				for(var i in items){
					if(items.hasOwnProperty(i) && jQuery.isNumeric(i)){
						getParent(items[i]);
					}
				}
			}
		};
		
		var hierarchy = that.vhDialog.getTable().getModel().getData();
		getParent(hierarchy);
		
		return parent;
	};

	VersionsSelector.prototype.flattenTree = function(items,tree){
		if(tree.length > 0){
			for(var i = 0, iLen = tree.length; i < iLen; i++){
				items.push(Utils.removeMetadata(tree[i]));
				this.pushChildrens(tree[i],items);					
			}
		}else{
			this.pushChildrens(tree,items);
		}							
	};
	
	VersionsSelector.prototype.pushChildrens = function(array,items){
		for(var i in array){
			if(array.hasOwnProperty(i) && jQuery.isNumeric(i))
			{
				items.push(Utils.removeMetadata(array[i]));
				this.flattenTree(items,array[i]);
			}
		}
	};
	
	return VersionsSelector;
}, true);
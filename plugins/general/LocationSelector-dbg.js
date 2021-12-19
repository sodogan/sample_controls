/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["sap/ui/model/json/JSONModel",
               "retail/pmr/promotionaloffers/utils/Utils",
               "retail/pmr/promotionaloffers/plugins/general/SelectionLogic"], function(JSONModel,Utils, SelectionLogic){
   
	function LocationSelector(table){
		this.table = table;
		this.treeModel = new JSONModel();
		if(table){
			table.setModel(this.treeModel);
		}
	}
	
	function clearTokens(vhDialog){
		vhDialog.removeAllSelectedTokens();
		vhDialog.removeAllExcludedTokens();
	}
	
	function createToken(item){
		var id = item.N_ID + "";
		var name = item.Name || item.ExtNodeId || item.ExtLocationId || "";
		return new sap.m.Token({key: id, text: name}).data("range",	{ 
			"operation": sap.ui.comp.valuehelpdialog.ValueHelpRangeOperation.EQ, 
			"keyField": "NodeId",
			"value1": name,
			"value2": ""
		});			
	}
	
	function createExcludedToken(item){
		var token = createToken(item);
		var tokenData = token.data("range");
		tokenData.exclude = true;
		token.data("range", tokenData);
		return token;
	}
	
	LocationSelector.prototype = {
		passVHDialog: function(vhDialog,noDataText){
			this.vhDialog = vhDialog;
			var oTable = vhDialog.getTable();
			oTable.collapseAll();
			 
			var noDataLbl = new sap.m.Label({text : noDataText, textAlign: sap.ui.core.TextAlign.Center});
			noDataLbl.addStyleClass("sapUiTableCtrlEmptyMsg");
			oTable.setNoData(noDataLbl);
			
			this.vhDialog.setHandleRemoveAllSelectedBtn(this.handleRemoveAllSelected.bind(this));
			this.vhDialog.setHandleRemoveExcludeBtn(this.handleRemoveExclude.bind(this));
			this.vhDialog.setHandleRemoveAllExcludeBtn(this.handleRemoveAllExclude.bind(this));
		},
		setData : function(includeExclude, serviceData, offerInterval){
			this.offerInterval = offerInterval;
			//init tree         
			this.buildTreeLogic(includeExclude, serviceData, offerInterval);
			var selection = this.selector.getSelection();
			if(this.table && this.vhDialog){
			   this.updateTokens(selection);
			   this.renderSelections(this.table, this.treeModel);
			}
		},
		selectionChanged : function(event, disableSelectAll){
			var selection = event.getParameter("tableSelectionParams");
			if(selection.selectAll || selection.rowIndices.length > 1 || !selection.rowContext){
			      this.renderSelections(this.table, this.treeModel);
			      return;
			} 
			
			this.selectionLogic(selection.rowContext.getObject());	
			this.renderSelections(this.table, this.treeModel);
		},
		expand : function(params){
			var object = {};
			if (params.isObject) {
				object = params.rowContext;
			} else {
				object = params.rowContext.getObject();
			}
			
			var expanded = params.expanded;
			this.toggleExpandItem(object, expanded);	
			if (params.isObject) {
				this.renderExpand(this.table, this.treeModel, object);					
			}
			this.renderSelections(this.table, this.treeModel);
		},
		buildTreeLogic: function(includeExclude, locationsSet, offerInterval){
			this.initTree(locationsSet, includeExclude, offerInterval);						
		},
		selectionLogic : function selectionLogicImpl(object){
			var checkValue = !object.checked;
			this.selector.runSelection(object, checkValue, this.offerInterval.StartOfOffer, this.offerInterval.EndOfOffer);
			var selection = this.selector.getSelection();
			this.updateTokens(selection);
		},      
		updateTokens : function(selection){						
			clearTokens(this.vhDialog);
			if(selection.selection){
				var includedToken = createToken(selection.selection);
				var excludes = selection.exclusions.map(createExcludedToken);
				var allTokens = [includedToken].concat(excludes);
				this.vhDialog.setTokens(allTokens);
			}
		},		           
		getTable : function(){
			return this.table;
		},
		asyncExpand : function(params){
			setTimeout(function(){
				this.expand(params);	
			}.bind(this));
		},
		getSelection: function(){
			return this.selector.getSelection();
		},		
		handleRemoveExclude: function(oEvent) {
			var token = oEvent.getParameter("token");
			var key = token.getKey();			
			var node = this.selector.getById(key);
			this.selectionLogic(node);
			this.renderSelections(this.table, this.treeModel);
		},
		handleRemoveAllSelected: function(oEvent) {			
			var tokens = [];
			if(oEvent instanceof Array){
				tokens = oEvent;
			}else{
				tokens.push(oEvent.getParameter("token"));
			}			
			this.removeTokens(tokens);
			this.renderSelections(this.table, this.treeModel);
		},		
		handleRemoveAllExclude: function(tokens) {			
			this.removeTokens(tokens);
			this.renderSelections(this.table, this.treeModel);
		},
		removeTokens : function(tokens){
			var keys = tokens.map(function(token){ return token.getKey(); });
			
			keys.forEach(function(key){
				var node = this.selector.getById(key);
				this.selectionLogic(node);
			}, this);
		}		
	};		
	LocationSelector.prototype.select = function(item, selected){
		if(!Utils.isClosed(item,this.offerInterval.StartOfOffer,this.offerInterval.EndOfOffer)){
			item.checked = selected;
		}		
	};
	LocationSelector.prototype.setExpand = function(item, expanded){
		item.expanded = expanded;
	};
	LocationSelector.prototype.isExpanded = function(item){
		return !!item.expanded;
	};
	LocationSelector.prototype.traverse = function(items, fn){
		for(var i in items){
			if(items.hasOwnProperty(i) && jQuery.isNumeric(i)){
				fn(items[i]);
				if(this.isExpanded(items[i])){					
					this.traverse(items[i], fn);
				}
			}
		}
	};
	LocationSelector.prototype.flattenItems = function(items){
		var result = [];
		this.traverse(items, function(item){
			result.push(item);
		});
		return result;
	};
	LocationSelector.prototype.selectAt = function(table, index){
		if(table){
			table.addSelectionInterval(index, index);
		}
	};
	LocationSelector.prototype.renderSelections = function(table, model){
		var items = model.getData();
		if(table){
			table.clearSelection();
			table.refreshRows(true);
			table.getModel().refresh(true);
		}
		var rows = this.flattenItems(items);
		for(var i = 0; i < rows.length; i++){
			if(rows[i].checked){
				this.selectAt(table, i);
			}
		}
	};
	LocationSelector.prototype.renderExpand = function(table, model, object){
		var items = model.getData();
		
		var rows = this.flattenItems(items);
		for(var i = 0; i < rows.length; i++){
			var currentRow = rows[i];
			var locationRow = currentRow.LocationId || currentRow.NodeId || currentRow.ExtNodeId;
			var locationObject = object.LocationId || object.NodeId || object.ExtNodeId;
			if(rows[i].expanding && locationRow === locationObject){
				rows[i].expanded = true;
				table.expand(i);
				table.expand(i);
				break;
			}
		}
	};
	LocationSelector.prototype.unexpandAll = function(items){
		for(var i in items){
			if(items.hasOwnProperty(i) && jQuery.isNumeric(i)){
				items[i].expanded = false;
				this.unexpandAll(items[i]);
			}
		}
	};
	LocationSelector.prototype.toggleExpandItem = function(object, expanded){
		this.setExpand(object, expanded);
		if(!expanded){
			this.unexpandAll(object);
		}
	};
	LocationSelector.prototype.initTree = function(locationsSet, includeExclude, offerInterval){      
		var locations = Utils.filterData(locationsSet, offerInterval);			
		var treeData = Utils.buildHierarchyVH(locations);
		
		var includedNodes = includeExclude.ID ? [includeExclude.ID] : [];
		var excludedNodes = (includeExclude.ExcludeNodes || []).map(function(node){
			return node.NodeId || node.LocationId || node.Id;
		});            		
		this.treeModel.setData(treeData);
		this.selector = new SelectionLogic(treeData, includedNodes, excludedNodes, offerInterval);
	};	
   
	return LocationSelector;
}, true);
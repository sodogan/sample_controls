/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["retail/pmr/promotionaloffers/utils/Utils",
               "retail/pmr/promotionaloffers/utils/Models",
               "retail/pmr/promotionaloffers/utils/Constants",
               "sap/ui/model/json/JSONModel",
               "sap/ui/model/Filter"
               ], function(Utils,Models,Constants,JSONModel,Filter){
	
var DefineUIBuilderHelper = function(
		controlConfigurationArry,
		allSFBFilters,
		radioVisible,
		parentContext,
		filterArry){
	this.controlConfigurations = controlConfigurationArry;
	this.filters = allSFBFilters;
	this.radioVisible = radioVisible;
	this.parentContext = parentContext;
	this.filterValues = filterArry;
	
	this.i18nBundle = Utils.getResourceModel().getResourceBundle();
	
	this.defaultCtrlsVisible = [];
	this.controlls = [];
	this.multiInputs = [];
	this.radioGroup = null;
	this.oMoreFilters = null;
	this.additionalFilters = [];
	this.radioSelectListeners = [];
	
	//add default filters
	this.calculateVisibleFilters();
	
	//add filters based on payload
	this.calculateAdditionalFilters();
	
	this.generateControls();
};

DefineUIBuilderHelper.prototype.createHorizontalLayout = function(content){
	return new sap.ui.layout.HorizontalLayout({
		content: content
	});
};

DefineUIBuilderHelper.prototype.removeOldContent = function(){
	var content = this.parentContext.dialog.getContent();
	if(content && content.length >= 2){
		//[0] is the smartfilterbar
		var grid = content[1];
		var radioPanel = grid.getContent()[0];
		var filtersPanel = grid.getContent()[1];
		
		grid.removeContent(radioPanel);
		grid.removeContent(filtersPanel);
		
		return grid;
	}
	
	return null;
};
DefineUIBuilderHelper.prototype.generateControls = function(){
	var that = this;
	this.controlls = [];
	var addCtrlsToUI = function(item){
		var grid = that.createGrid();
		var sLbl = new sap.m.Label({text: item["sap:label"] || item[0]["sap:label"], width: "150px"});				
		var sCtrl = item.control || item[0].control;
		sCtrl.setWidth("300px");
		sCtrl.searchKey = item.name;
		
		var hL = that.createHorizontalLayout([sLbl,sCtrl]);
		grid.addContent(hL);
		that.multiInputs.push(sCtrl);
		that.controlls.push(grid);
	};
	
	this.defaultCtrlsVisible.forEach(addCtrlsToUI);
	
	if(this.additionalFilters && this.additionalFilters.length > 0){
		this.additionalFilters.forEach(addCtrlsToUI);
	}
};
DefineUIBuilderHelper.prototype.generateMoreFiltersCtrl = function(){
	var that = this;
	var grid = this.createGrid();
	var sLbl = new sap.m.Label({text: "", width: "150px", visible: false});
	var linkCtrl = new sap.m.Link({
		text : that.i18nBundle.getText("Product.Groups.Filter.More.Link"),
		press: that.handleMoreFilterPress.bind(that)
	});
	
	grid.addContent(this.createHorizontalLayout([sLbl,linkCtrl]));
	
	return grid;
};
DefineUIBuilderHelper.prototype.handleMoreFilterPress = function(oEvent){
	var that = this;
	this.oMoreFilters = sap.ui.xmlfragment("retail.pmr.promotionaloffers.plugins.productGroup.fragments.MoreFilters", this);
	this.oMoreFilters.setModel(Utils.getResourceModel(), "i18n");
	
	var data = new JSONModel();
	//var filtersArry = jQuery.extend([],this.filters).map(function(item){
	var filtersArry = this.filters.map(function(item){
		var isVisible = false;
		that.defaultCtrlsVisible.forEach(function(visible){
			if(visible.fieldName === item.fieldName){
				isVisible = true;
			}
		});
		
		return { Property: item.fieldName,Label: item.fieldLabel, isSelected: isVisible ? true : false };
	});
	
	data.setProperty("/CheckboxFilters",filtersArry);
	this.oMoreFilters.setModel(data);
	this.oMoreFilters.open();
};
DefineUIBuilderHelper.prototype.createPanel = function(){
	var panel = new sap.m.Panel({
		expandable: false,
		expanded: true,
		width: "100%"
	});
	
	return panel;
};
DefineUIBuilderHelper.prototype.createGrid = function(defaultSpan,defaultIndent){
	var grid = new sap.ui.layout.Grid({
		defaultSpan: defaultSpan || "L12 M12 S12",
		defaultIndent: defaultIndent || "L0 M0 S0"
	});
	grid.setVSpacing(0);
	
	return grid;
};
DefineUIBuilderHelper.prototype.createButtonsArry = function(){
	var that = this;
	var allUnmodifiedSubnodes = new sap.m.RadioButton({
		text: that.i18nBundle.getText("Product.Groups.Radion.Btn.All.Unmodified.Subnodes")
	});
	var allSubnodes = new sap.m.RadioButton({
		text: that.i18nBundle.getText("Product.Groups.Radion.Btn.All.Subnodes")
	});
	var onlyThisNode = new sap.m.RadioButton({
		text: that.i18nBundle.getText("Product.Groups.Radion.Btn.Only.This.Node")
	});
	
	return [allUnmodifiedSubnodes,allSubnodes,onlyThisNode];
};
DefineUIBuilderHelper.prototype.fireRadioSelect = function(e){
	this.radioSelectListeners.forEach(function(l){
		return l(e);
	});
};  
DefineUIBuilderHelper.prototype.addRadioListener = function(l){
	this.radioSelectListeners.push(l);
}; 
DefineUIBuilderHelper.prototype.createRadioGroup = function(){
	var that = this;
	var grid = this.createGrid();
	
	this.radioGroup = new sap.m.RadioButtonGroup({
		buttons : that.createButtonsArry()
	});
	this.radioGroup.attachSelect(function(e){
		that.fireRadioSelect(e);
	}); 
	var label = new sap.m.Label({text: that.i18nBundle.getText("Product.Groups.Apply.Changes.To")});
	label.addStyleClass("sapUiTinyMarginTop");
	
	var hL = this.createHorizontalLayout([label,this.radioGroup]);
	grid.addContent(hL);

	return grid;
};
DefineUIBuilderHelper.prototype.getCtrlsForDialog = function(emptyGrid){
	var panelRadio = null;
	var filterPanel = null;
	
	if(Constants.DialogModeEnum.WithRadio === this.radioVisible){
		panelRadio = this.createPanel();
		panelRadio.addContent(this.createRadioGroup());
	}
	
	if(this.controlls && this.controlls.length > 0){
		filterPanel = this.createPanel();
		this.controlls.forEach(function(contrl){
			filterPanel.addContent(contrl);
		});	

		filterPanel.addContent(this.generateMoreFiltersCtrl());
	}
	
	var gridLayout = null;
	if(!emptyGrid){
		gridLayout = this.createGrid();
	}else{
		gridLayout = emptyGrid;
	}
		
	if(filterPanel){
		gridLayout.insertContent(filterPanel);
	}
	
	if(panelRadio){
		gridLayout.insertContent(panelRadio);
	}
	
	return gridLayout;	
};
DefineUIBuilderHelper.prototype.calculateVisibleFilters = function(newFilters){
	var that = this;

	this.defaultCtrlsVisible = [];
	
	function insertFilter(f){
		that.defaultCtrlsVisible.push(f);
	}
	if(newFilters && newFilters.length > 0){
		newFilters.forEach(insertFilter);
	}else{
		this.controlConfigurations.map(function(item){	
			var itemKey = item.getKey();
			return that.filters.filter(function(f){
				return f.fieldName === itemKey;
			});
		}).forEach(insertFilter);
	}
};
DefineUIBuilderHelper.prototype.handleSearch = function(oEvent){
	if(oEvent.getSource().getParent() && oEvent.getSource().getParent().getItems().length > 0){
		var aFilters = [];
		var sQuery = oEvent.getSource().getValue();
		if (sQuery && sQuery.length > 0) {
			var filter = new Filter("Label", sap.ui.model.FilterOperator.Contains, sQuery);
			aFilters.push(filter);
		}
		
		var list = oEvent.getSource().getParent().getItems()[1];
		var bindings = list.getBinding("items");
		bindings.filter(aFilters, "Application");
	}
};
DefineUIBuilderHelper.prototype.onMoreFiltersCancel = function(oEvent){
	this.oMoreFilters.close();
	this.oMoreFilters.destroy();
};
DefineUIBuilderHelper.prototype.onMoreFiltersOk = function(oEvent){
	var visibleFilters = this.oMoreFilters.getModel().getData().CheckboxFilters.filter(function(iter){
		return iter.isSelected;
	}).map(function(item){
		return item.Property;
	});
	
	this.parentContext.updateFilters(visibleFilters);
};

DefineUIBuilderHelper.prototype.destroyDialog = function(){
	this.oMoreFilters.close();
	this.oMoreFilters.destroy();
};

DefineUIBuilderHelper.prototype.redrawFilters = function(newFilters){
	this.calculateVisibleFilters(newFilters);
	var grid = this.removeOldContent();
	this.generateControls();
	
	return grid;
};
DefineUIBuilderHelper.prototype.getRadioSelection = function(){
	return this.radioGroup.getSelectedIndex();
};

DefineUIBuilderHelper.prototype.calculateAdditionalFilters = function(){
	var that = this;
	
	if(this.filterValues && this.filterValues.length > 0){
		var additionalFilters = this.filterValues.map(function(item){
			return {Property: item.Property};
		});
		
		var noDuplicates = [];
		additionalFilters.forEach(function(filter){
			var found = noDuplicates.some(function(iter){
				return iter.Property === filter.Property;
			});
			
			if(!found){
				noDuplicates.push(filter);
			}
		});
		
		var uniqueFilters = [];
		noDuplicates.forEach(function(filter){
			var unique = that.controlConfigurations.some(function(item){
				return item.getKey() === filter.Property;
			});
			
			if(!unique){
				uniqueFilters.push(filter);
			}
		});
		
		that.additionalFilters = [];
		if(uniqueFilters && uniqueFilters.length > 0){
			this.filters.forEach(function(item){
				uniqueFilters.forEach(function(uniq){
					if(uniq.Property === item.fieldName){
						that.parentContext.smartFilterBar.addFieldToAdvancedArea(item.fieldName);
						that.additionalFilters.push(item);
					}
				});
			});
		}
	}		
};

return DefineUIBuilderHelper;
});
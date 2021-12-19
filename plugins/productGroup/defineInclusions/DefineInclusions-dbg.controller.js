/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
/*global Promise*/
sap.ui.define([
		"sap/ui/core/mvc/Controller",
		"sap/ui/model/json/JSONModel",
		"retail/pmr/promotionaloffers/utils/Utils",
		"retail/pmr/promotionaloffers/utils/DateHandler",
		"retail/pmr/promotionaloffers/utils/Formatter"
	], function(Controller, JSONModel, Utils, DateHandler, FormatterHelper) {

	"use strict";
	
	function controllerById(view,id){
		return view.byId(id).getController();
	}
	
	return Controller.extend("retail.pmr.promotionaloffers.plugins.productGroup.defineInclusions.DefineInclusions", {
		
		constructor : function(){
			this.contentModel = new JSONModel();
			this.dataModel = new JSONModel();
			this.timeModel = new JSONModel();
		},
		
		onInit: function() {
			this.getView().setModel(this.contentModel, "Content");
			this.getView().setModel(this.dataModel);
			this.productsTableController = controllerById(this, "productsTableView");
			this.productsHierarchyTableController = controllerById(this, "productHierarchy");
			var resourceModel = Utils.getResourceModel();
			this.getView().setModel(resourceModel, "i18n");
			
			this.contentModel.setProperty("/Editable", true);
			this.oMessageManager = Utils.getMessageManager();
			this.i18nModel = Utils.getResourceModel();			
		},
		
		getHierarchyIncludedProducts: function() {
			return this.productsHierarchyTableController.getDataInclude();
		},
		
		setTableState: function(busy, isHierarchyAction) {
			if (isHierarchyAction) {
				this.productsHierarchyTableController.setTableState(busy);
			} else {
				this.productsTableController.setTableState(busy);
				this.productsTableController.removeTableSelections();
			}
			
		},
		
		getProductGroupData : function() {
			var hierarchyPayload = { Payload : this.productsHierarchyTableController.getProductGroupData()};
			var oData = jQuery.extend({}, this.productsTableController.getProductGroupData(), hierarchyPayload);	
			return oData;
		},
		getPGFilters: function(){
			var pgFilters = this.productsHierarchyTableController.getPGFilters();
			var oData = jQuery.extend([], pgFilters);	
			return oData;
		},
		
		setProductGroupData : function(data, IsNew) {	
			this.dataModel.setData(data);	
			this.contentModel.setProperty("/EditableName", IsNew);
			this.contentModel.setProperty("/ReadOnly", !!data.Display);
			this.productsHierarchyTableController.setProductGroupData(data);
			this.productsTableController.setProductGroupData(data, true);			
		},
		resetProductHierarchy: function(){
			this.productsHierarchyTableController.resetIncludes();
		},
		resetProductSearch: function(){
			this.productsTableController.resetSearchField();
		}
	});
});

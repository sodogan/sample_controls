/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
/*global Promise*/
sap.ui.define([
		"sap/ui/core/mvc/Controller",
		"sap/ui/model/json/JSONModel",
		"retail/pmr/promotionaloffers/utils/Utils",
		"retail/pmr/promotionaloffers/utils/DateHandler",
		"retail/pmr/promotionaloffers/utils/Formatter",
		"retail/pmr/promotionaloffers/plugins/productGroup/ProductsCategoryHelper"
	], function(Controller, JSONModel, Utils, DateHandler, FormatterHelper, ProductsCategoryHelper) {

	"use strict";
	
	return Controller.extend("retail.pmr.promotionaloffers.plugins.productGroup.preview.Preview", {
		
		constructor: function(){
			Controller.apply(this, arguments);
			this.dataProvider = null;
			this.contentModel = new JSONModel();
			this.dataModel = new JSONModel();
			this.onDemandProductsModel = new JSONModel();
		},
		
		onInit: function() {
			this.getView().setModel(this.contentModel, "Content");
			this.getView().setModel(this.dataModel);

			var resourceModel = Utils.getResourceModel();
			this.getView().setModel(resourceModel, "i18n");
			this.contentModel.setProperty("/Editable", true);
			this.oMessageManager = Utils.getMessageManager();
			this.i18nModel = Utils.getResourceModel();
			this.resetModel();
			this.state = this.getOwnerComponent().getState();
			this.masterDataSystem = this.state.offerData.MasterdataSystem; 
			this.productCategoryHelper = new ProductsCategoryHelper(this.masterDataSystem,[],[]);
		},
		
		getTable: function() {
   			return sap.ui.getCore().byId("listViewTable");
   		},
		
   		getTreeTable: function() {
   			return sap.ui.getCore().byId("categoryViewTable");
   		},
   		
   		getSmartTable: function(){
   			return sap.ui.getCore().byId("previewHierarchySmartTable");
   		},
   		
   		getPopUpTable: function() {
   			return sap.ui.getCore().byId("onDemandProductsTable");
   		},
   		
		getProductGroupData: function() {
			var previewData = {
					Search: this.contentModel.getProperty("/Search"),
					Skip: this.contentModel.getProperty("/Skip"),
					Top: this.contentModel.getProperty("/Top")
			}; 	
			return previewData;
		},
		
		getEventBus : function(){
   			return sap.ui.getCore().getEventBus();
   		},
		
		setTableState: function(busy) {
			var table = this.getTable();
			var treeTable = this.getTreeTable();
			var popUpTable = this.getPopUpTable();
			if (table) {
				table.setBusy(busy);
			}
			if (treeTable) {
				treeTable.setBusy(busy);
			}
			if (popUpTable) {
				popUpTable.setBusy(busy);
			}
			
		},
		
		setProductGroupData: function(data, IsRefresh) {	
			if (this.IsListView) {
				var products = [];
				var displayCount = 0;
				var displayTotal = 0;
				this.IsRefresh = IsRefresh;
				if (IsRefresh) {
					this.resetModel();
					var productGroupItems = [];
					this.dataModel.setProperty("/ProductGroupItems", productGroupItems);
					this.updateCount(displayCount, displayTotal);
				}
				if (data && data.Preview) {
					displayCount += this.contentModel.getProperty("/DisplayCount") + 20;
					products = data.Preview.results || data.Preview;
					displayTotal = data.Cardinality;
				}
				var validCardinality = data && data.Cardinality ? data.Cardinality : "0";
				this.dataModel.setProperty("/Cardinality", validCardinality);
				var existingProducts = this.dataModel.getProperty("/ProductGroupItems");
				if (existingProducts && existingProducts.length > 0) {
					this.dataModel.getProperty("/ProductGroupItems").pop();
				}	
				productGroupItems = (this.dataModel.getProperty("/ProductGroupItems") || []).concat(products);
				this.dataModel.setProperty("/ProductGroupItems", productGroupItems);
				this.contentModel.setProperty("/ProductGroupItems", productGroupItems);	
				this.updateCount(displayCount, displayTotal);
				if (data && data.Preview) {
					data.Preview.results = this.dataModel.getProperty("/ProductGroupItems").slice(0, 21);
				}
				this.populateSearchFieldForListView();
			} else {
				// this is for category view
				this.dataModel.setProperty("/ProductGroupItems", []);
				this.contentModel.setProperty("/DisplayCount", 0);
				this.productCategoryHelper.setProductsCategory(data);
				var hierarchy = this.productCategoryHelper.getHierarchy(true);
				this.contentModel.setProperty("/HierarchyPreview", hierarchy);	
				this.dataModel.setProperty("/HierarchyPreview", this.contentModel.getProperty("/HierarchyPreview"));
				this.refreshTreeTable();	
				this.smartTable = this.getSmartTable();
				this.smartTable.setHeader(this.i18nModel.getResourceBundle().getText("ProductGroupPage.ProductsTable.TableTitle", data.Cardinality));
				this.populateSearchFieldForCategoryView();
			}
			this.previewData = data; 			
		},
		
		refreshTreeTable: function() {
			var treeTable = this.getTreeTable();
			treeTable.refreshRows(true);
			treeTable.getModel().refresh(true);
			treeTable.setSelectionBehavior(sap.ui.table.SelectionBehavior.RowOnly);
		},
		
		
		onSegmentButtonPress: function(oEvent) {
			var arrayId = oEvent.getParameters().id.split("-");
			var currentSelection = arrayId[0];
			var fragmentName = "retail.pmr.promotionaloffers.plugins.productGroup.preview.ListView";
			this.IsListView = true;
			this.dataModel.setProperty("/ProductGroupItems", this.listViewData);
			if (currentSelection === "categoryViewButton") {
				fragmentName = "retail.pmr.promotionaloffers.plugins.productGroup.preview.CategoryView";
				this.IsListView = false;
			}
			this.changeFragment(fragmentName);	
			this.segmentedButtonController = sap.ui.getCore().byId("segmentedButtonId");
			this.segmentedButtonController.setSelectedButton(oEvent.getParameters().button);
			this.setProductGroupData(this.previewData);
			this.getEventBus().publish("retail.pmr.promotionaloffers", "reselectTab", {indexSection: 3});
		},
		
		populateSearchFieldForListView: function(isPopUp) {
			if (isPopUp && this.popUpSearchValue) {
				var popUpSearchField = sap.ui.getCore().byId("popUpSearchField");
				popUpSearchField.setValue(this.popUpSearchValue);
				return;
			}
			if (this.searchValue) {
				var searchField = sap.ui.getCore().byId("searchField");
				searchField.setValue(this.searchValue);
			}		
		},
		
		populateSearchFieldForCategoryView: function() {	
			if (this.categorySearchValue) {
				var searchField = sap.ui.getCore().byId("searchFieldCategory");
				searchField.setValue(this.categorySearchValue);
				this.searchTreeTableAfterAValue(this.categorySearchValue);
			}
		},
		
		resetSearch: function(){
			var searchInput = sap.ui.getCore().byId("searchField");
			if(searchInput){
				searchInput.setValue("");				
			}
			
			this.searchValue = null;
		},
		
		resetModel: function(isPopUp) {
			if (isPopUp) {
				this.oldContentModel = {};
				jQuery.extend(true, this.oldContentModel, this.contentModel);
			}
			this.contentModel.setProperty("/Search", "");
			this.contentModel.setProperty("/Skip", 0);
			this.contentModel.setProperty("/Top", 21);
			this.updateCount(0, 0, isPopUp);
			if (!isPopUp) {
				this.IsListView = true;
				this.changeFragment("retail.pmr.promotionaloffers.plugins.productGroup.preview.ListView");
			}	
		},
		
		onUpdateStarted: function(oEvent) {
			var sReason = oEvent.getParameter("reason");
			var skip = this.contentModel.getProperty("/DisplayCount");
			if(sReason === "Growing") {
				this.setTableState(true);
				var iGrowing = 21;
				this.contentModel.setProperty("/Search", "");
				this.contentModel.setProperty("/Skip", skip);
				this.contentModel.setProperty("/Top", iGrowing);
				this.getEventBus().publish("retail.pmr.promotionaloffers", "onAction", {isPreviewAction: true});
			}
		},
		
		updateCount: function(display, total, isPopUp) {
			this.contentModel.setProperty("/DisplayCount", display);
			this.contentModel.setProperty("/TotalCount", total);
			setTimeout(function() {
				jQuery(isPopUp ? "#onDemandProductsTable-triggerInfo" : "#listViewTable-triggerInfo").text("[" + display + "/" + total + "]");
			}, 100);
			
		},
		
		changeFragment: function(fragmentName) {
			if (this.oFragment) {
				this.oFragment.destroy(true);
			}
			var oLayout = this.getView().byId("mainLayout");
            this.oFragment = sap.ui.xmlfragment(fragmentName, this);
			oLayout.addContent(this.oFragment);			
		},
		
		searchAfterAValue: function(searchValue, isPopUp) {
			this.resetModel(isPopUp);
			var skip = 0;
			var iGrowing = 21;
			this.contentModel.setProperty("/Search", searchValue);
			this.contentModel.setProperty("/Skip", skip);
			this.contentModel.setProperty("/Top", iGrowing);
			this.dataModel.setProperty("/ProductGroupItems", []);
			var objectToSend = {
					isPreviewAction: true
			};
			if (isPopUp) {
				this.onDemandProductsModel.setProperty("/ProductGroupItems", []);
				objectToSend.launchPopUp = false; 
				objectToSend.NodeId = this.categoryObj.Id;
			} else {
				this.dataModel.setProperty("/ProductGroupItems", []);
			}
			this.getEventBus().publish("retail.pmr.promotionaloffers", "onAction", objectToSend);
			this.populateSearchFieldForListView(isPopUp);
			
		},
		
		onLiveChange: function(oEvent){
			this.setTableState(true);
			this.searchValue = oEvent.getParameter("query");
			this.searchAfterAValue(this.searchValue);
		},
		
		searchTreeTableAfterAValue: function(searchValue) {
			var bindings = this.smartTable.getTable().getBinding("rows");		
   			var filterProps = ["Name"];
   			var tableFilter = Utils.uiFilter(filterProps);	
   			bindings.filter([tableFilter(searchValue)]);
   			this.refreshTreeTable();
		},
		
		onLiveChangeTreeTable: function(oEvent) {	
   			var searchValue = oEvent.getParameter("newValue") || "";
   			this.categorySearchValue = searchValue;
   			this.searchTreeTableAfterAValue(this.categorySearchValue);
   		},
   		
   		onCategorySelected: function(oEvent) {
   			var source = oEvent.getSource();
   			this.categoryObj = {
   					Id : source.data("Id"),
   					Cardinality : source.data("Cardinality"),
   					Name : source.getText()
   					
   			};
   			this.resetModel(true);
			this.setTableState(true);
  		    this.getEventBus().publish("retail.pmr.promotionaloffers", "onAction", {isPreviewAction: true, launchPopUp: true, NodeId: this.categoryObj.Id});
   		},
   		
   		setPopUpData: function(data) {
   			if (data.Skip === "0") {
   				this.contentModel.setProperty("/DisplayCount", 0);
   			}
   			var existingProducts = this.onDemandProductsModel.getProperty("/ProductGroupItems");
			if (existingProducts && existingProducts.length > 0) {
				this.onDemandProductsModel.getProperty("/ProductGroupItems").pop();
			}	
   			var productGroupItems = data.Preview ? data.Preview.results || data.Preview : [];
   			var products = this.onDemandProductsModel.getProperty("/ProductGroupItems").concat(productGroupItems);
			this.onDemandProductsModel.setProperty("/ProductGroupItems", products);
			var displayCount = this.contentModel.getProperty("/DisplayCount") + 20;
			var displayTotal = this.categoryObj.Cardinality;
			this.updateCount(displayCount, displayTotal, true);
			this.popUpTable = this.getPopUpTable();
			this.setTableState(false);
   		},
   		
   		launchProductDialog: function(data) {
   			this.onDemandProductsModel.setData(data);
   			this.onDemandProductsModel.setProperty("/ProductGroupItems", []);
   			this.onDemandProductsModel.setProperty("/Cardinality", this.categoryObj.Cardinality);
   			this.onDemandProductsModel.setProperty("/DialogTitle", this.categoryObj.Name);
   			this.setPopUpData(data);
			var treeTable = this.getTreeTable();
			var that = this;
   			var oDialog = sap.ui.xmlfragment("retail.pmr.promotionaloffers.plugins.productGroup.preview.OnDemandProducts",{
				onClose: function(oEvent){
					oEvent.getSource().getParent().close();
					if (oDialog) {
						oDialog.destroy(true);
					}
					treeTable.clearSelection();
					if (that.oldContentModel) {
						that.contentModel = that.oldContentModel;
						that.contentModel.setProperty("/DisplayCount", 0);
					}
				},
   				onPopUpSearch: function(oEvent) {
   					that.onPopUpSearch(oEvent);
   				},
   				onPopUpUpdateStarted: function(oEvent) {
   					that.onPopUpUpdateStarted(oEvent);
   				},
   				onListViewTableRebind : function(){
   					var displayedCount = that.contentModel.getProperty("/DisplayCount");
   					var totalCount = that.contentModel.getProperty("/TotalCount");
   					that.updateCount(displayedCount, totalCount, true);
   				}
			});
			
			oDialog.setModel(Utils.getI18NModel(), "i18n");
			oDialog.setModel(this.onDemandProductsModel);
		
			oDialog.open();
   		},
   		
   		onPopUpSearch: function(oEvent) {
   			this.setTableState(true);
			this.popUpSearchValue = oEvent.getParameter("query");
			this.searchAfterAValue(this.popUpSearchValue, true);
   		},
   		
   		onPopUpUpdateStarted: function(oEvent) {
   			var sReason = oEvent.getParameter("reason");
			var skip = this.contentModel.getProperty("/DisplayCount");
			if(sReason === "Growing") {
				this.setTableState(true);
				var iGrowing = 21;
				this.contentModel.setProperty("/Search", "");
				this.contentModel.setProperty("/Skip", skip);
				this.contentModel.setProperty("/Top", iGrowing);
				this.getEventBus().publish("retail.pmr.promotionaloffers", "onAction", {isPreviewAction: true, launchPopUp: false, NodeId: this.categoryObj.Id});
			}
   		},
   		onListViewTableRebind : function(){
   			var displayedCount = this.contentModel.getProperty("/DisplayCount");
			var totalCount = this.contentModel.getProperty("/TotalCount");
			this.updateCount(displayedCount, totalCount);
   		}
   			
	});
});
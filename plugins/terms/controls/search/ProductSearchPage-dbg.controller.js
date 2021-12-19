/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
/*global Promise*/
sap.ui.define([
   		"sap/ui/core/mvc/Controller",
   		"retail/pmr/promotionaloffers/utils/Models",
   		"retail/pmr/promotionaloffers/utils/Utils",
   		"retail/pmr/promotionaloffers/utils/TreeValueHelpDialog",
   		"sap/ui/model/json/JSONModel",
   		"retail/pmr/promotionaloffers/Component"
   	], function(Controller, Models, Utils, TreeValueHelpDialog, JSONModel, Component) {

	var PRODUCT_DIMENSION = "01";
	
	var OPTION_CONST = {
		bt: function(){return "BT"; },
		cp: function(){return "CP"; },
		endswith: function(){return "CP"; },
		startswith: function(){return "CP"; },
		eq: function(){return "EQ"; },
		nb: function(){return "NB"; },
		ne: function(){return "NE"; },
		np: function(){return "NP"; },	
		gt: function(){return "GT"; },
		ge: function(){return "GE"; },
		lt: function(){return "LT"; },
		le: function(){return "LE"; }
	};

	var getOption = function(tokenValue, currLength) {
		
		function getTokenValue(val){
			return (val || "").toUpperCase();
		}
		
		function returnSign() {
			return "I";
		}

		function isEqual() {

			return {
				"Id": currLength + 1,
				"Attribute": tokenValue.sPath,
				"Sign": returnSign(),
				"Option": OPTION_CONST.eq(),
				"Low": getTokenValue(tokenValue.oValue1)
			};
		}
		function isNotEqual() {

			return {
				"Id": currLength + 1,
				"Attribute": tokenValue.sPath,
				"Sign": "E",
				"Option": OPTION_CONST.eq(),
				"Low": getTokenValue(tokenValue.oValue1)
			};
		}

		function isContains() {

			return {
				"Id": currLength + 1,
				"Attribute": tokenValue.sPath,
				"Sign": returnSign(),
				"Option": OPTION_CONST.cp(),
				"Low": getTokenValue("*" + tokenValue.oValue1 + "*")
			};
		}

		function isBetween() {

			return {
				"Id": currLength + 1,
				"Attribute": tokenValue.sPath,
				"Sign": returnSign(),
				"Option": OPTION_CONST.bt(),
				"Low": getTokenValue(tokenValue.oValue1),
				"High" : getTokenValue(tokenValue.oValue2)
			};
		}

		function isEndsWith() {

			return {
				"Id": currLength + 1,
				"Attribute": tokenValue.sPath,
				"Sign": returnSign(),
				"Option": OPTION_CONST.endswith(),
				"Low": getTokenValue("*" + tokenValue.oValue1)
			};
		}

		function isStartsWith() {
			return {
				"Id": currLength + 1,
				"Attribute": tokenValue.sPath,
				"Sign": returnSign(),
				"Option": OPTION_CONST.startswith(),
				"Low": getTokenValue(tokenValue.oValue1 + "*")
			};
		}
		
		function isGreaterThan() {
			return {
				"Id": currLength + 1,
				"Attribute": tokenValue.sPath,
				"Sign": returnSign(),
				"Option": OPTION_CONST.gt(),
				"Low": getTokenValue(tokenValue.oValue1)
			};
		}
		
		function isGreaterThanOrEqual() {
			return {
				"Id": currLength + 1,
				"Attribute": tokenValue.sPath,
				"Sign": returnSign(),
				"Option": OPTION_CONST.ge(),
				"Low": getTokenValue(tokenValue.oValue1)
			};
		}
		
		function isLowerThan() {
			return {
				"Id": currLength + 1,
				"Attribute": tokenValue.sPath,
				"Sign": returnSign(),
				"Option": OPTION_CONST.lt(),
				"Low": getTokenValue(tokenValue.oValue1)
			};
		}
		
		function isLowerThanOrEqual() {
			return {
				"Id": currLength + 1,
				"Attribute": tokenValue.sPath,
				"Sign": returnSign(),
				"Option": OPTION_CONST.le(),
				"Low": getTokenValue(tokenValue.oValue1)
			};
		}
		
		var options = {
				"EQ": isEqual,
				"Contains": isContains,
				"BT": isBetween,
				"EndsWith": isEndsWith,
				"StartsWith": isStartsWith,
				"GT": isGreaterThan,
				"GE": isGreaterThanOrEqual,
				"LT": isLowerThan,
				"LE": isLowerThanOrEqual,
				"NE": isNotEqual
		};
		return options[tokenValue.sOperator]();
	};
	
	var getFilters = function(filter, index, filters) {
	    if (filter.aFilters) {
	        for (var i = 0; i < filter.aFilters.length; i++) {
	            getFilters(filter.aFilters[i], index++, filters);
	        }
	    }
	    else {
	    	filters.push(getOption(filter, index));
	    }
	    
	};
	
	function handleNetWeight(source, control) {
		source.setValueState("None");
		control.setValueState("None");
		if(!control.getValue().length && source.getValue().length) {
			control.setValueState("Error");
		} else if(control.getValue().length && !source.getValue().length)
		 {
		 	source.setValueState("Error");
		 }
	}
	
	function hasTermFilter(filters) {
		var hasTerm = filters.filter(function(filter){
			return filter.Attribute === "TERM";
		});
		return !!hasTerm.length;
	}
	
	function CallHelper(controller){
		/* In the resultset, the label vendor is renamed as Source because the resultset is derived from both Vendors and Distribution Centers */
		var metaProperties = controller.table.metaProperties;
		for(var i = 0, iLen = metaProperties.length; i < iLen; i++) {
				if(metaProperties[i].property === "Vendor") {
					metaProperties[i].label="{i18n>Terms.Advanced.Product.Source}";
				}
		}	
		var that = controller;
		this.termObjectsCall = function(skip,top,filters, multipleCalls){
			return Models.searchTermsObjects(skip, top, filters, multipleCalls, hasTermFilter(filters)).then(function(data){			
				that.table.setMaxCount(data.Total);
				var aTermObjects = data.TermObjects;
				var termsData =  that.data.getProperty("/TermObjects/results");
				
				if(aTermObjects && aTermObjects.results){
					aTermObjects.results.forEach(function(item){
						item.isLoadingVisible = multipleCalls;
					});
				}
				
				if(termsData && aTermObjects) {
					termsData.splice(termsData.length - 1, 1);
					aTermObjects.results = termsData.concat(aTermObjects.results);
				}		
				// force paging
				if(aTermObjects.results.length < data.Total) {
					aTermObjects.results.push({});
				}
				
				that.data.setData({TermObjects: aTermObjects});
				that.selectAllProducts();
				
				that.table.setBusy(false);
			});
		};
		
		this.pricesCall = function(skip,top,filters, wait){
			return Models.searchTermsObjects(skip, top, filters, false, hasTermFilter(filters)).then(function(priceData){
				//the wait help with any potential race conditions.
				return (wait || Promise.resolve()).then(function(){
					return priceData;
				});
			}).then(function(dataWithPrices){
				var termsWithoutPriceInfo =  that.data.getProperty("/TermObjects/results") || [];
				var termsWithPriceInfo = Utils.get(dataWithPrices, ["TermObjects", "results"]) || [];
				
				termsWithoutPriceInfo.forEach(function(noPriceItem){
					var foundPriceInfo = termsWithPriceInfo.filter(function(productWithPrice){
						return productWithPrice.ProductId === noPriceItem.ProductId;
					});
					if(foundPriceInfo.length){
						var priceData = foundPriceInfo[0];
						noPriceItem.ProductDetail.Currency = priceData.ProductDetail.Currency;
						noPriceItem.ProductDetail.PurchasePrice = priceData.ProductDetail.PurchasePrice;
						noPriceItem.ProductDetail.RetailPrice = priceData.ProductDetail.RetailPrice;
						noPriceItem.ProductDetail.RetailPriceWithVAT = priceData.ProductDetail.RetailPriceWithVAT;
						noPriceItem.ProductDetail.SalesUom  = priceData.ProductDetail.SalesUom;
					}
					noPriceItem.isLoadingVisible = false;
				});
				
				that.data.setProperty("/TermObjects/results", termsWithoutPriceInfo);
				that.selectAllProducts();
			});
		};
	}
	
	function MultiCallHandler(controller){
		var helper = new CallHelper(controller);
		var doMultipleCalls = true;
		this.getMore = function(skip, top, filters){
			//execute both calls in parallel, but stop the loading process one the fast call is done
			var termObjectCall = helper.termObjectsCall(skip, top, filters, doMultipleCalls); 
			helper.pricesCall(skip,top,filters, termObjectCall);
			
			return termObjectCall;
		};
	}
	
	function SingleCallHandler(controller){
		var helper = new CallHelper(controller);
		var doMultipleCalls = false;
		this.getMore = function(skip, top, filters){
			return helper.termObjectsCall(skip, top, filters, doMultipleCalls);
		};
	}
	
	return Controller.extend("retail.pmr.promotionaloffers.plugins.terms.controls.search.ProductSearchPage", {
		constructor: function(){
			this.data = new JSONModel();
			this.data.setDefaultBindingMode("OneWay");	
			this.contentModel = new JSONModel();
			this.oConfig = Component.getMetadata().getConfig();
		},

		onInit : function(oFragment, masterdataSystem, dimension, i18nTitle, resolve, reject, multiSelect, selectedProducts) {
			this.oFragment = oFragment;
			this.dimension = dimension || PRODUCT_DIMENSION;
			this.masterdataSystem = masterdataSystem;
			this.resolve = resolve;
			this.reject = reject;
			this.state = Utils.getComponent().getState();
			this.oFragment.setModel(this.data, "Data");
			var oDataModel = Models.getServiceModel();
			this.oFragment.setModel(oDataModel);
			this.oFragment.setModel(Utils.getI18NModel(), "i18n");
			this.oFragment.setModel(this.contentModel, "Content");
			this.contentModel.setProperty("/ShowOkButton", multiSelect ? true : false);
			this.contentModel.setProperty("/HideTypeFilter", (dimension === "11" || dimension === "12" ) ? false : true);
			this.multiSelect = multiSelect;
			this.selectedProducts = selectedProducts;
			this.table = sap.ui.getCore().byId("productSearchTable");		
			this.filterBar = sap.ui.getCore().byId("productSearchSmartFilterBar");
			this.table.setMode(multiSelect ? "MultiSelect" : "SingleSelectMaster");
			var title = Utils.getI18NModel().getResourceBundle().getText(i18nTitle);
			
			var oHierarchyFilterInput = this.getHierarchyFilterInput();
			oHierarchyFilterInput.setBusy(true);  
			Models.getLeadingCategoriesSet(this.masterdataSystem).then(function(){
				oHierarchyFilterInput.setBusy(false);  
			});
			
			if(typeof title === "string"){
				this.oFragment.setTitle(title);
			}
			
			this.priceFieldsNames = [];
			
			
			var multipleCalls = this.oConfig.productSearchMultipleCalls;
			
			this.getMoreHandler = multipleCalls ? 
					new MultiCallHandler(this) :
					new SingleCallHandler(this);
			
			
			this.oFragment.open();	
		},
		
		onInitialise: function(oEvent) {
			var allFields = oEvent.getSource()._aFields;
			for(var i = 0, iLen = allFields.length; i < iLen; i++) {
				if(allFields[i]["sap:unit"] === "Currency") {
					this.priceFieldsNames.push(allFields[i].fieldName);
					this.filterBar.getControlByKey(allFields[i].fieldName).attachChange(this.handlePriceChange.bind(this));
				}
				if( allFields[i].fieldName.indexOf("AT_00000_" + this.masterdataSystem) === -1 &&
					allFields[i].fieldName.indexOf("AT_00001_" + this.masterdataSystem) === -1 &&
					allFields[i].fieldName.indexOf("AT_" + this.masterdataSystem) === -1 &&
					allFields[i].fieldName.indexOf("AT_") === 0 ) {
					
					allFields[i].visible = false;
					allFields[i].isVisible = false;
					allFields[i].visibleInAdvancedArea = false;
					allFields[i].preventInitialDataFetchInValueHelpDialog = false;	
				}
			}
			if(this.filterBar.getControlByKey("NetWeight")) {
				this.filterBar.getControlByKey("NetWeight").attachChange(this.onNetWeightChanged.bind(this));
			}
			if(this.filterBar.getControlByKey("NetWeightUom")) {
				this.filterBar.getControlByKey("NetWeightUom").attachChange(this.onNetWeightUomChanged.bind(this));
			}
			if(this.filterBar.getControlByKey("Currency")) {
				this.filterBar.getControlByKey("Currency").attachChange(this.handlePriceChange.bind(this));	
			}
		},		
		
		onNetWeightChanged: function(oEvent) {
			var control = this.filterBar.getControlByKey("NetWeightUom");
			this.filterBar.addFieldToAdvancedArea("NetWeightUom");
			var source = oEvent.getSource();
			handleNetWeight(control, source);
		},
		
		onNetWeightUomChanged: function(oEvent) {
			var control = this.filterBar.getControlByKey("NetWeight");
			this.filterBar.addFieldToAdvancedArea("NetWeight");
			var source = oEvent.getSource();
			handleNetWeight(control, source);
		},
		
		handlePriceChange: function(oEvent) {
			var coutVals = 0;
			var currency = this.filterBar.getControlByKey("Currency");
			function setState(allControls, valueState) {
				allControls.forEach(function(c){
					c.setValueState(valueState);
				});
			}
			var controls = this.priceFieldsNames.map(function(name){
				var control = this.filterBar.getControlByKey(name);
				if(control.getValue().length) {
					coutVals++;
				}
				return control;
			}.bind(this));
			
			setState(controls, "None");
			currency.setValueState("None");
			
			if(coutVals > 1 || (!coutVals && currency.getValue().length)) {
				setState(controls, "Error");
			}
			if(coutVals > 0 && !currency.getValue().length) {
				this.filterBar.addFieldToAdvancedArea("Currency");
				currency.setValueState("Error");
			}	
			if(coutVals === 0 && currency.getValue().length) {
				currency.setValueState("Error");
			}
		},
		
		onShowAttributePressed: function(oEvent) {
			var source = oEvent.getSource();
			var path = 	source.getParent().getBindingContext("Data").getPath();
			var model = this.oFragment.getModel();
			var data = this.table.getModel("Data").getProperty(path).ProductDetail;
			var element = "/TermObjects(Id=binary'" + Utils.base64ToHex(data.Id)
				+ "',Dimension='" + data.Dimension + "')";
			
			var oDialog = sap.ui.xmlfragment("retail.pmr.promotionaloffers.fragments.ShowAttributesDialog",{
				onClose: function(oEvent){
					oEvent.getSource().getParent().close();
				},
				formatValue: function(val, desc) {
					if(desc) {
						return desc + " (" + val + ")";
					}
					return val;
				},
				formatLabel: function(label) {
					return label + ":";
				}
			});
			
			oDialog.setModel(Utils.getI18NModel(), "i18n");
			oDialog.setModel(model);
			
			oDialog.bindElement(element);
			oDialog.open();
		},
		
		onCancelPress: function() {
			this.oFragment.close();
		},
		
		onClose: function() {
			this.reject();
			this.oFragment.destroy();
		},
		
		onOkPress: function(oEvent) {
			this.resolve(this.selectedProducts);
			this.oFragment.close();
		},

		onSelectRow: function(oEvent) {
			var that = this;
			var oSelectedItems = oEvent.getSource().getSelectedItems();
			this.selectedProducts = [];
			this.selectedProducts = this.selectedProducts.concat(this.existingProductsUnchecked);

			if (oSelectedItems) {
				oSelectedItems.forEach(function(item) {
					var oItemData = item.getBindingContext("Data").getObject();
					that.selectedProducts.push(oItemData);
				});
					
			}
			
			if (!this.multiSelect) {	
				var oSelectedItem = oEvent.getSource().getSelectedItem();
				var oItemData = oSelectedItem.getBindingContext("Data").getObject();
				this.resolve(oItemData.Id);
				this.oFragment.close();
			}
		},
		
		selectAllProducts: function() {
			var that = this;
			this.existingProductsUnchecked = [];
			if (this.selectedProducts) {
				this.selectedProducts.forEach(function(existingProduct) {
					that.selectProduct(existingProduct);
				});
			}	
		},
		
		selectProduct: function(existingProduct) {
			var allProducts = this.table.getItems();
			for (var i = 0; i < allProducts.length; i++) {
				var product = allProducts[i].getBindingContext("Data").getObject();
				if (product.Id === existingProduct.Id) {
					this.table.setSelectedItem(allProducts[i]);
					break;
				}
				if (i === allProducts.length - 1) {
					this.existingProductsUnchecked.push(existingProduct);
				}
			}
		},
		
		onUpdateStarted: function(oEvent) {
			var sReason = oEvent.getParameter("reason");
			var skip = oEvent.getParameter("actual");
			if(this.aFilters && sReason === "Growing") {
				var iGrowing = this.table.getGrowingThreshold();
				this.getMore(skip, iGrowing, this.aFilters, true);
			}
		},
		
		searchFunction: function(e) {
			var index = 0;
			var sDefaultPageSize = "100";
			var sPageSize = "";
			var filters = [];
			
			// set Page size/GrowingThreshold
			sPageSize = this.filterBar.getControlByKey("PageSize").getValue();
			if (sPageSize === "" || parseInt(sPageSize, 10) <= 0) {
				sPageSize = sDefaultPageSize;
				this.filterBar.getControlByKey("PageSize").setValue(sPageSize);
			}
			this.table.setGrowingThreshold(parseInt(sPageSize, 10));
			
			//Remove previous selections 
			this.table.removeSelections(true);

			if(this.filterBar.getFilters().length) {
				getFilters(this.filterBar.getFilters()[0], index, filters);
			}
			this.addHierarchyNodeFilters(filters);
			this.fetchData(filters);
		},
		
		/* 
		 * Can be overridden in order to change the search filters
		 */
		getExtraFilters: function(filters) {
			return filters;
		},

		fetchData: function(filters){
			
			if (!filters) {
				filters = [];
			}

			var defaultFilters = [{
				"Id" : filters.length + 1,
				"Attribute" : "PROD_DIM_TCD",
				"Sign" : "I",
				"Option" : "EQ",
				"Low" : this.dimension
			},{
				"Id" : filters.length + 2,
				"Attribute" : "MD_SYSTEM_REF",
				"Sign" : "I",
				"Option" : "EQ",
				"Low" : this.masterdataSystem
			}];
			var skip = 0;
			var top = this.table.getGrowingThreshold();
			var allFilters = filters.concat(defaultFilters);
			this.getMore(skip, top, this.getExtraFilters(allFilters), false);
		},
		
		getMore: function(skip, top, filters, grow){
			if(!grow) {
				this.table.resetGrowing();
				this.data.setProperty("/TermObjects/results", []);
				this.aFilters = filters;
			}
			
			var that = this;
			that.table.setBusy(true);
			
			this.getMoreHandler.getMore(skip, top, filters).then(function(){
				that.table.setBusy(false);
			}, function(error){
				jQuery.sap.log.trace(error);
				that.table.setBusy(false);
			});
					
		},
		
		// HierarchyFilter
		
		handleHierarchyComplexSearch: function() {
			
			var updateSelectedRowsArray = function(item, array) {
				var index = Utils.getItemIndexInArray(item.Id || item, array);
				if (index !== -1){
					array.splice(index, 1);
				} else {
					array.push(item);
				}
				return array;
			};
			
			var getCurrentItemsSelected = function(tokens) {	
				var itemsSelected = tokens.map(function(token) {			
						return token.getCustomData()[0].getValue();
				});
				return itemsSelected;
			}; 
			
			var oLeadingCategorySetPromise = Models.getLeadingCategoriesSet(this.masterdataSystem);
			oLeadingCategorySetPromise.then(function(aLeadingCategoriesSet){
				var hierarchyNodeControl = sap.ui.getCore().byId("hierarchyNodeFilter");
				var tokens = hierarchyNodeControl.getTokens() || [];
				var itemsSelected = getCurrentItemsSelected(tokens);
				TreeValueHelpDialog.openDialog({
	   				tableFragment: "retail.pmr.promotionaloffers.plugins.general.LeadingCategoryComplexSearch",
					title : "{i18n>productHierarchy.Title}",
					filterProps : ["ExtId","Name","HierarchyDescription","ExtHierarchyId"],
					values : Utils.buildHierarchy(aLeadingCategoriesSet,"LeadingCategory"),
					multiselect : true ,
					styleClass: "sapUiSizeCompact",
					tokens : tokens,
					selectionChange: function(e){
						var table = e.getSource().getTable();		
						var params = e.getParameter("tableSelectionParams");
						params.rowIndices.forEach(function(index) {
							var context = table.getContextByIndex(index);
							if (context) {
								var object = context.getObject();
								object.currentPath = context.getPath();
								updateSelectedRowsArray(object, itemsSelected);
							}
						}); 
						return itemsSelected;
					},
					tokenRemove: function(e) {
						if (!e) {
							itemsSelected = [];
							return;
						}
						
						var arrayOfTokenKeysRemoved = e.getParameters().tokenKeys;
						arrayOfTokenKeysRemoved.forEach(function(item) {
							updateSelectedRowsArray(item, itemsSelected);
						});
					},
					ok: function(e){
						tokens = itemsSelected.map(Utils.createTokenForHierarchy);
						hierarchyNodeControl.setTokens(tokens);
						e.getSource().close();					
					}
				});
			});		
		},
		
		onHierarchyTokensChange: function(oEvent) {
			var hierarchyNodeControl = this.getHierarchyFilterInput();
			var tokens = hierarchyNodeControl.getTokens();
			hierarchyNodeControl.removeAllCustomData();
			if (tokens && tokens.length > 0) {
				hierarchyNodeControl.addCustomData(new sap.ui.core.CustomData({key: "hasValue", value: true}));
			}	
			hierarchyNodeControl.fireChangeEvent();
		},
		
		getHierarchyFilterInput: function() {
			return sap.ui.getCore().byId("hierarchyNodeFilter");
		},
		
		beforeVariantSave: function(e) {
			var hierarchyFilter = this.getHierarchyFilterInput();
			var hierarchyTokens = hierarchyFilter.getTokens();
			var currentSelected = this.getHierarchiesSelected(hierarchyTokens);		
			var oldData = jQuery.extend(true, {}, this.filterBar.getFilterData());
			oldData._CUSTOM = {"hierarchyFilterSelections":currentSelected};
			this.filterBar.setFilterData(oldData, true);	
		},
		
		afterVariantLoad: function(e) {
			var hierarchyFilter = this.getHierarchyFilterInput();
			var oData = this.filterBar.getFilterData();
			var oCustomFieldData = oData["_CUSTOM"];
			hierarchyFilter.removeAllTokens();
			
			if (oCustomFieldData && oCustomFieldData.hierarchyFilterSelections) {
				var hierarchyFilterTokens  = oCustomFieldData.hierarchyFilterSelections.map(function(item){
					return Utils.createTokenForHierarchy(item);
				});	
				if (hierarchyFilterTokens.length > 0 ) {
					hierarchyFilter.setTokens(hierarchyFilterTokens);
				}	
			}
			
		},
		
		getHierarchiesSelected: function(hierarchyTokens) {
			return hierarchyTokens.map(function(token) {
				return jQuery.extend(true, {}, token.getCustomData()[0].getValue());
			});
		},
		
		addHierarchyNodeFilters : function(filters) {
			var hierarchyNodeControl = sap.ui.getCore().byId("hierarchyNodeFilter");
			if (hierarchyNodeControl) {
				var tokens = hierarchyNodeControl.getTokens();
				if (tokens && tokens.length > 0) {
					tokens.forEach(function(token) {
						var filterObj = {
								"Id" : filters.length + 1,
								"Attribute" : "HierarchyNode",
								"Sign" : "I",
								"Option" : "EQ",
								"Low" : token.getCustomData()[0].getValue().ExtId,
								"High" : token.getCustomData()[0].getValue().HierarchyId
							};
						filters.push(filterObj);
					});
				}
			}
				
		}
		
	});	
});
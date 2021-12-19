/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["sap/m/Input", 
               "sap/m/InputRenderer", 
               "retail/pmr/promotionaloffers/utils/Models",
               "retail/pmr/promotionaloffers/utils/Utils",
               "sap/ui/core/ListItem",
               "sap/ui/model/json/JSONModel",
               "sap/ui/comp/valuehelpdialog/ValueHelpDialog"], 
function(Input, InputRenderer, Models, Utils, ListItem, JSONModel, ValueHelpDialog){
	
	var PRODUCT_COUPON_DIMENSION = "01";
	var PRODUCT_COUPON_TYPE = "13";
	
	function getInputValue(product){
		if(!product){
			return "";
		}
		
		if(!product.ExtNodeId){
			return product.Name;
		}
		
		if(!product.Name){
			return product.ExtNodeId;
		}
		
		return product.ExtNodeId + " - " + product.Name;		
	}
	
	function populateProductInput(input, product){
		if( product ){
			input.setValue(product.ExtNodeId);
			input.setDescription(product.Name);
		}else {
			input.setValue(null);
			input.setDescription(null);
		}
		
	}
	
	
	return Input.extend("retail.pmr.promotionaloffers.plugins.terms.controls.ProductCouponCombo", {
		metadata : {
			properties : {
				masterdataSystem : { type : "string" },
				productCouponId : { type : "string" }				
			}
		},
		renderer : InputRenderer,
		_changeProxy : function(){},
		init : function(){
			this.attachSuggest(this._onSuggest); 
			this.attachSuggestionItemSelected(this._onSuggestionItemSelected); 
			this.setStartSuggestion(3);
			this.setShowSuggestion(true);
			this.setMaxSuggestionWidth("550px");
			this.setShowValueHelp(true);
			this.attachValueHelpRequest(this.initAdvancedSearch);
			this.attachChange(this.validateCoupon);
			
			this.setFilterFunction(function(value, item){
				function contains(a, b){
					return a.indexOf(b) > -1;
				}
				var data = item.data;
				var lowerCaseValue = value.toLowerCase();
				return contains((data.Name + "").toLowerCase(), lowerCaseValue) || contains((data.ExtNodeId + "").toLowerCase(), lowerCaseValue);
			});
		},

		destroy: function() {
			this.clearErrorMessage();
			Input.prototype.destroy.apply(this, arguments);
		},

		clearErrorMessage: function() {
			var sPath = this.getBindingContext().getPath();
			Utils.removeMessagesByPath(sPath);
			this.setValueState("None");
		},

		createVHD: function(input,i18n){
			var that = this;
			this.couponAdvancedSearch = new ValueHelpDialog({
				title: i18n.getResourceBundle().getText("Terms.CouponAdvancedSearch.DialogTitle"),
				supportMultiselect: false,
				stretch: sap.ui.Device.system.phone,
				cancel: function() {
					this.close();
				},
				selectionChange : function(e){
					var selectionTable = e.getParameter("tableSelectionParams");
					var index = selectionTable.rowIndex;
					var selectedCoupon = selectionTable.rowContext.getModel().getData()[index];
					
					that.setProductCouponId(selectedCoupon.Id);
					populateProductInput(that, selectedCoupon);
					
					this.close();
					that.clearErrorMessage();
				}							
			});
			this.couponAdvancedSearch.addStyleClass("sapUiSizeCompact");
		},
		
		setTable: function(i18nBundle){
			var table = sap.ui.xmlfragment("retail.pmr.promotionaloffers.plugins.terms.controls.ProductCouponCombo", this);
			
			table.setModel(i18nBundle, "i18n");
			table.setBusy(true);
			
			this.couponModel = new JSONModel();
			table.setModel(this.couponModel);
			
			this.couponAdvancedSearch.setTable(table);
		},
		
		makeCall: function(input,basicSearchValue,flatenFilters){
			var that = this;
			Models.getCoupons(input.getMasterdataSystem(),basicSearchValue,PRODUCT_COUPON_DIMENSION, PRODUCT_COUPON_TYPE,flatenFilters).then(function(data){
				var manipArry = [];
				
				for(var i = 0, iLen = data.Coupons.length; i < iLen; i++){
					var item = {};
					
					item.Id = data.Coupons[i].Id;
					item.MasterdataSystem = data.Coupons[i].MasterdataSystem;
					item.ExtNodeId = data.Coupons[i].ExtNodeId;
					item.Name = data.Coupons[i].Name;
					item.StatusName = data.Coupons[i].ProductDetail.StatusName;
					
					manipArry.push(item);
				}
				
				that.couponModel.setData(manipArry);
				that.couponAdvancedSearch.getTable().setBusy(false);
			});
		},
		
		getFilterItems: function(i18n){
			var filterItems = [];
			var definedFilters = [{label:i18n.getResourceBundle().getText("Terms.CouponAdvancedSearch.ExtNodeId"),key:"ExtNodeId"},
			                      {label:i18n.getResourceBundle().getText("Terms.CouponAdvancedSearch.Name"),key:"Name"}];

			for(var t = 0; t < definedFilters.length; t++){
				var item = new sap.m.MultiInput(this.getFilterBarSettings([{label:definedFilters[t].label,key:definedFilters[t].key}],definedFilters[t].label));
				//fix to show the suggestion popup
				item.setFilterFunction(function(){return true; });

				item.searchKey = definedFilters[t].key;
				var filterItem = new sap.ui.comp.filterbar.FilterItem({
					control : item,
					name : definedFilters[t].label,
					partOfCurrentVariant : true,
					label: definedFilters[t].label
				});

				filterItems.push(filterItem);
			}
			
			return filterItems;
		},
		
		initAdvancedSearch: function(oEvent){
			var that = this;
			var input = oEvent.getSource();
			var i18nBundle = Utils.getResourceModel();
			var i18n = Utils.getI18NModel();
			
			if (!this.couponAdvancedSearch) {
				this.createVHD(input,i18n);
				this.setTable(i18nBundle);
				
				var oFilterBar = new sap.ui.comp.filterbar.FilterBar({
					advancedMode: true,
					filterBarExpanded: true,
					showGoOnFB: true,
					filterItems: that.getFilterItems(i18n),
					search: function(event) {
						that.couponAdvancedSearch.getTable().setBusy(true);
						var filters = Utils.calculateFilters(event);
						var flatenFilters = Utils.flatenFilters(filters);

						var basicSearchValue = Utils.setBasicSearchValue.call(that,"couponAdvancedSearch");

						that.makeCall(input,basicSearchValue,flatenFilters);
					}
				});

				var basicSearchField = new sap.m.SearchField({
					showSearchButton: sap.ui.Device.system.phone,
					placeholder: i18n.getResourceBundle().getText("General.Location.Picker.Placeholder")
				});

				if (oFilterBar.setBasicSearch) {
					oFilterBar.setBasicSearch(basicSearchField);
				}

				oFilterBar.setSearchEnabled(true);
				that.couponAdvancedSearch.setFilterBar(oFilterBar);
			}
						
			
			var basicSearch = input.getProperty("value");
			if(basicSearch.length > 0){
				this.couponAdvancedSearch.setBasicSearchText(basicSearch);
			}
			
			this.makeCall(input,basicSearch);	
			this.couponAdvancedSearch.getTable().clearSelection();
			this.couponAdvancedSearch.open();
		},
		
		getFilterBarSettings: function(ranges,title){
			var that = this;

			var nameSettings = {
					valueHelpRequest:function(){
						var that = this;
						var supportedRanges = [
	                       sap.ui.comp.valuehelpdialog.ValueHelpRangeOperation.BT,
	                       sap.ui.comp.valuehelpdialog.ValueHelpRangeOperation.Contains,
	                       sap.ui.comp.valuehelpdialog.ValueHelpRangeOperation.EQ,
	                       sap.ui.comp.valuehelpdialog.ValueHelpRangeOperation.EndsWith,
	                       sap.ui.comp.valuehelpdialog.ValueHelpRangeOperation.GE,
	                       sap.ui.comp.valuehelpdialog.ValueHelpRangeOperation.GT,
	                       sap.ui.comp.valuehelpdialog.ValueHelpRangeOperation.LE,
	                       sap.ui.comp.valuehelpdialog.ValueHelpRangeOperation.LT,
	                       sap.ui.comp.valuehelpdialog.ValueHelpRangeOperation.StartsWith
	                    ];

						var valueHelpName = new sap.ui.comp.valuehelpdialog.ValueHelpDialog({
							supportMultiselect: true,
							supportRanges: true,
							supportRangesOnly: true,
							title: title,
							ok: function(oControlEvent) {
								that.setTokens(oControlEvent.getParameters().tokens);
								valueHelpName.close();
							},
							cancel: function(oControlEvent) {
								valueHelpName.close();
							},
							afterClose: function() {
								valueHelpName.destroy();
							}
						});

						valueHelpName.setIncludeRangeOperations(supportedRanges);
						valueHelpName.setRangeKeyFields(ranges);
						valueHelpName.setTokens(that.getTokens());
						valueHelpName.open();
					}
				};

				return nameSettings;
		},
		
		_onSuggest : Utils.throttle(function(e){
			var input = e.getSource();
			var suggestValue = e.getParameter("suggestValue");
			Models.getProducts(input.getMasterdataSystem(), suggestValue, PRODUCT_COUPON_DIMENSION, PRODUCT_COUPON_TYPE).then(function(data){
				input.destroySuggestionItems();
				data.Products.map(function(product){
					var item = new ListItem({
						key : product.Id,
						text : getInputValue(product),
						additionalText : product.TypeName
					});
					item.data = product;
					return item;
				}).forEach(function(item){
					input.addSuggestionItem(item);
				});
			});	
		}, 250),
		
		_onSuggestionItemSelected : function(e){
			var input = e.getSource();
			var item = e.getParameter("selectedItem");
			var product = item.data;
			input.setProductCouponId(product.ProductId);
			populateProductInput(input, product);
			this.clearErrorMessage();
		},

		validateCoupon: function(e) {
			var iSuggestionIndex = e.getSource()._iPopupListSelectedIndex;
			if (iSuggestionIndex > -1) {
				// Suggestion selected.
				return;
			}

			var input = e.getSource();
			var value = input.getValue();
			if (!value) {
				this.clearErrorMessage();
				return;
			}
			Models.searchProduct(input.getMasterdataSystem(), value.toUpperCase(), PRODUCT_COUPON_DIMENSION, PRODUCT_COUPON_TYPE).then(function(data) {
				if (data.Products.length) {
					var product = data.Products[0];
					input.setProductCouponId(product.ProductId);
					populateProductInput(input, product);
				} else {
					input.setProductCouponId(null);
					input.setValue(value);
					input.setDescription(null);
					
					var sPath = input.getBindingContext().getPath();
					var aPathParts = sPath.split("/");
					var iIndex = aPathParts[2];
					iIndex = parseInt(iIndex, 10) + 1;
					var i18n = Utils.getI18NModel();
					var oMessageManager = Utils.getMessageManager();
					var aMessages = [{
						message: i18n.getResourceBundle().getText("CreateOffer.Terms.InvalidProductCoupon.Title"),
						description: i18n.getResourceBundle().getText("CreateOffer.Terms.InvalidProductCoupon.Description", iIndex),
						type: "Error",
						target: sPath,
						processor: input.getBindingContext().getModel()
					}];
					Utils.setErrorMessages(oMessageManager, aMessages);
					input.setValueState("Error");
				}
			});
		},

		setProductCouponId : function(value){
			this.clearErrorMessage();
			var that = this;
			if (!value) { 
				that.setProperty("productCouponId", null);
				populateProductInput(that, null);
				return; 
			}
			Models.getProductById(value, PRODUCT_COUPON_DIMENSION).then(function(product){
				that.setProperty("productCouponId", product.ProductId);
				populateProductInput(that, product);
			}, function(error) {
				that.setProperty("productCouponId", null);
				if(error){
					jQuery.sap.log.error(error);
				}
			});
		}
	});
});
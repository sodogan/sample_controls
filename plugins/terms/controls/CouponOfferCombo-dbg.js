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

	var COUPON_OFFER = "O01";
	var NON_COUPON_OFFER = "O09";
	this.sLastSelection = "";
	function getInputValue(offer){
		if(!offer){
			return "";
		}
		
		if(!offer.ExtOfferId){
			return offer.Name;
		}
		
		if(!offer.Name){
			return offer.ExtOfferId;
		}
		
		return offer.ExtOfferId + " - " + offer.Name;		
	}
	
	function populateCouponOfferInput(input, offer){
		if(offer){
			input.setValue(offer.ExtOfferId);
			input.setDescription(offer.Name);
		} else {
			input.setValue(null);
			input.setDescription(null);
		}
	}
	
	return Input.extend("retail.pmr.promotionaloffers.plugins.terms.controls.CouponOfferCombo", {
		metadata : {
			properties : {
				productRelevant : { type : "string" },
				couponOfferId : { type : "string" }
			}
		},
		renderer : InputRenderer,
		_changeProxy : function(){},
		init : function(){
			this.attachSuggest(this._onSuggest); 
			this.attachSuggestionItemSelected(this._onSuggestionItemSelected); 
			this.setStartSuggestion(1);
			this.setShowSuggestion(true);
			this.setMaxSuggestionWidth("550px");
			this.setShowValueHelp(true);
			this.attachValueHelpRequest(this.initAdvancedSearch);
			this.attachChange(this.validateCouponOffer);
			
			this.setFilterFunction(function(value, item){
				function contains(a, b){
					return a.indexOf(b) > -1;
				}
				var data = item.data;
				var lowerCaseValue = value.toLowerCase();
				return contains((data.Name + "").toLowerCase(), lowerCaseValue) || contains((data.ExtOfferId + "").toLowerCase(), lowerCaseValue);
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

		createVHD: function(input,i18n,select){
			var that = this;
			var sTitle = "";
			if (select === COUPON_OFFER) {
			    sTitle = i18n.getResourceBundle().getText("Terms.CouponOfferAdvancedSearch.DialogTitle");
			} else {
			    sTitle = i18n.getResourceBundle().getText("Terms.OfferAdvancedSearch.DialogTitle");
			}
			this.couponOfferAdvancedSearch = new ValueHelpDialog({
		        title : sTitle,
				supportMultiselect: false,
				stretch: sap.ui.Device.system.phone,
				cancel: function() {
					this.close();
				},
				selectionChange : function(e){
					var selectionTable = e.getParameter("tableSelectionParams");
					var index = selectionTable.rowIndex;
					var selectedCouponOffer = selectionTable.rowContext.getModel().getData()[index];
					
					that.setCouponOfferId(selectedCouponOffer.OfferId);
					populateCouponOfferInput(that, selectedCouponOffer);
					
					this.close();
					that.clearErrorMessage();
				}							
			});
			//this.couponOfferAdvancedSearch.addStyleClass("sapUiSizeCompact");
		},
		
		setTable: function(i18nBundle,select){
			var table = sap.ui.xmlfragment("retail.pmr.promotionaloffers.plugins.terms.controls.CouponOfferCombo", this);
			var sExtOfferIdLabel = "";
			if (select === COUPON_OFFER) {
			    sExtOfferIdLabel = i18nBundle.getResourceBundle().getText("Terms.CouponOfferAdvancedSearch.ExtOfferId");
	        } else {
	            sExtOfferIdLabel = i18nBundle.getResourceBundle().getText("Terms.OfferAdvancedSearch.ExtOfferId");
	        }
			table.getColumns()[0].getLabel().setText(sExtOfferIdLabel);
			table.setModel(i18nBundle, "i18n");
			table.setBusy(true);
			
			this.couponOfferModel = new JSONModel();
			table.setModel(this.couponOfferModel);
			
			this.couponOfferAdvancedSearch.setTable(table);
		},

        // oData call		
		makeCall: function(input,basicSearchValue,select,flatenFilters){
			var that = this;

			Models.getCouponOffers(basicSearchValue,select,flatenFilters).then(function(offers){

				var manipArry = [];
				for(var i = 0, iLen = offers.length; i < iLen; i++){
					var item = {};
					item.OfferId = offers[i].OfferId;
					item.ExtOfferId = offers[i].ExtOfferId;
					item.Name = offers[i].Name;
					item.Status = offers[i].Status;
					item.StatusName = offers[i].StatusName;
					
					manipArry.push(item);
				}
				
				that.couponOfferModel.setData(manipArry);
				that.couponOfferAdvancedSearch.getTable().setBusy(false);
			});
		},
		
		// copy from Utils and make name search case sensitive (same as Offer List)
		calculateFilters: function(o){
			var filters = [];
			var searchFilters = o.getParameters().selectionSet || [];
			for(var index = 0, filtersLen = searchFilters.length; index < filtersLen; index++){

				if(searchFilters[index].getValue().length > 0){
					var nItem = {};
					nItem.key = searchFilters[index].searchKey;
					nItem.exclude = false;
					var filterValue = searchFilters[index].getValue() || "";
					nItem.value1 = filterValue;
					nItem.value2 = "";
					if(nItem.key === "Name"){
						nItem.operator = "Contains";
						filters.push(Utils.getOption(nItem));
						continue;
					}
					nItem.operator = "EQ";

					var filterFromTokens = [];
					filterFromTokens.push(nItem);
					
					if(searchFilters[index].getTokens().length > 0){
						filterFromTokens = Utils.getFiltersFromTokens(searchFilters,index);
					}
				}else{
					filterFromTokens = Utils.getFiltersFromTokens(searchFilters,index);
				}

				if(filterFromTokens.length > 0){
					var resu = Utils.getArryByIncludeOrExclude(filterFromTokens);
					filters.push(resu);
				}
			}
			return filters;
		},
		
		getFilterItems: function(i18n,select){
			var filterItems = [];
			var sLabel = "";
			if (select === COUPON_OFFER) {
			    sLabel = i18n.getResourceBundle().getText("Terms.CouponOfferAdvancedSearch.ExtOfferId");
			} else {
			    sLabel = i18n.getResourceBundle().getText("Terms.OfferAdvancedSearch.ExtOfferId");
			}
			var definedFilters = [{label:sLabel,key:"ExtOfferId"},
			                      {label:i18n.getResourceBundle().getText("Terms.CouponOfferAdvancedSearch.Name"),key:"Name"}];

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
			var sCurrentSelection = this.getProductRelevant();
			if (!this.couponOfferAdvancedSearch ||
			    (this.sLastSelection && this.sLastSelection !== sCurrentSelection)) {

			    this.sLastSelection = sCurrentSelection;
				this.createVHD(input,i18n,sCurrentSelection);
				this.setTable(i18nBundle,sCurrentSelection);
				
				var oFilterBar = new sap.ui.comp.filterbar.FilterBar({
					advancedMode: true,
					filterBarExpanded: true,
					showGoOnFB: true,
					filterItems: that.getFilterItems(i18n,sCurrentSelection),
					search: function(event) {
						that.couponOfferAdvancedSearch.getTable().setBusy(true);
						var filters = that.calculateFilters(event);
						var flatenFilters = Utils.flatenFilters(filters);
						var basicSearchValue = Utils.setBasicSearchValue.call(that,"couponOfferAdvancedSearch");
						that.makeCall(input,basicSearchValue,sCurrentSelection,flatenFilters);
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
				that.couponOfferAdvancedSearch.setFilterBar(oFilterBar);
			} //if (!this.couponOfferAdvancedSearch)
						
			var basicSearch = input.getProperty("value");
			if(basicSearch.length > 0){
				this.couponOfferAdvancedSearch.setBasicSearchText(basicSearch);
			}
			
			this.makeCall(input,basicSearch,sCurrentSelection,null);			
			this.couponOfferAdvancedSearch.open();
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
		
		validateInputValue: function(input) {
			var value = input.getValue();
			if (!value) {
				this.clearErrorMessage();
				this.setProperty("couponOfferId", null);
				populateCouponOfferInput(this, null);
				return;
			}
			var sSelect = this.getProductRelevant();
 			Models.getCouponOffers(value,sSelect).then(function(offers) {
				if (offers.length === 1) {
					var couponOffer = offers[0];
					input.setCouponOfferId(couponOffer.OfferId);
					populateCouponOfferInput(input, couponOffer);
				} else {
					input.setCouponOfferId(null);
					input.setValue(value);
					input.setDescription(null);
					
					var sPath = input.getBindingContext().getPath();
					var aPathParts = sPath.split("/");
					var iIndex = aPathParts[2];
					iIndex = parseInt(iIndex, 10) + 1;
					var i18n = Utils.getI18NModel();
					var oMessageManager = Utils.getMessageManager();
					var sDescription = "";
					if (sSelect === COUPON_OFFER) {
					    sDescription = i18n.getResourceBundle().getText("Terms.CouponOfferAdvancedSearch.ExtOfferId");
					} else {
					    sDescription = i18n.getResourceBundle().getText("Terms.OfferAdvancedSearch.ExtOfferId");
					}
					var aMessages = [{
						message: i18n.getResourceBundle().getText("CreateOffer.Terms.InvalidCouponOffer.Title") + " - " + sDescription,
						description: "",
						type: "Error",
						target: sPath,
						processor: input.getBindingContext().getModel()
					}];
					Utils.setErrorMessages(oMessageManager, aMessages);
					input.setValueState("Error");
				}
			});		    
		},
		
		// onSuggest here is not showing suggestItems.
		// It is used to validate user manual input without pressing enter key
		_onSuggest : function(e){
			var input = e.getSource();
			input.destroySuggestionItems();
			this.validateInputValue(input);
		},
		
		_onSuggestionItemSelected : function(e){
			var input = e.getSource();
			var item = e.getParameter("selectedItem");
			var couponOffer = item.data;
			input.setCouponOfferId(couponOffer.OfferId);
			populateCouponOfferInput(input, couponOffer);
			this.clearErrorMessage();
		},

		validateCouponOffer: function(e) {
			var iSuggestionIndex = e.getSource()._iPopupListSelectedIndex;
			if (iSuggestionIndex > -1) {
				// Suggestion selected.
				return;
			}
			var input = e.getSource();
			this.validateInputValue(input);
		},

		setCouponOfferId : function(value){
 			this.clearErrorMessage();
			var that = this;
			if (!value) { 
				that.setProperty("couponOfferId", null);
				populateCouponOfferInput(that, null);
				return; 
			} 
			Models.getCouponOfferById(value).then(function(offer){
				that.setProperty("couponOfferId", offer.OfferId);
				populateCouponOfferInput(that, offer);
			}, function(error) {
				that.setProperty("couponOfferId", null);
				if(error){
					jQuery.sap.log.error(error);
				}
			});
		}
	});
});
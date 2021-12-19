/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["sap/ui/model/json/JSONModel","retail/pmr/promotionaloffers/utils/Utils", "sap/m/MessageBox"], function(JSONModel, Utils, MessageBox){
	
	
	function presentInList(uom, listOfUoMs){
		for(var i = 0; i < listOfUoMs.length; i++){
			var currentUoM = listOfUoMs[i];
			if(currentUoM.Id === uom.Id){
				return true;
			}
		}
		return false;
	}
	
	function presentInAllLists(uom, listOfLists){
		var presencePerList = listOfLists.map(function(list){
			return presentInList(uom, list);
		});
		
		return presencePerList.reduce(function(a,b){
			return a && b;
		}, true);
	}
	
	function containsUnitOfMeasure(uom, xs){
		for(var k = 0; k < xs.length; k++){
			if(xs[k].Id === uom.Id){
				return true;
			}
		}
		return false;
	}
	
	function commonUnitsOfMeasure(unitsOfMeasureList){
		return  unitsOfMeasureList.reduce(function(result, currentList){
			var partialResult = currentList.filter(function(currentUoM){
				var isOkForFinalResult = presentInAllLists(currentUoM, unitsOfMeasureList) && !containsUnitOfMeasure(currentUoM, result);  
				return isOkForFinalResult;
			});
			return result.concat(partialResult);									
		}, []);
		
	}

	function parseNumber(number){
		
		if(jQuery.isNumeric(number)){
			return parseFloat(number);
		}		
		var numberFormat = sap.ui.core.format.NumberFormat.getFloatInstance({
			style: 'standard',
			groupingEnabled: false,
			minIntegerDigits: 0,
			maxIntegerDigits: 14,
			minFractionDigits: 0,
			maxFractionDigits: 5,
			emptyString : null
		});
		return numberFormat.parse(number);
	}
	
	function formatNumber(number){
		var numberFormat = sap.ui.core.format.NumberFormat.getFloatInstance({
			style: 'standard',
			groupingEnabled: false,
			minIntegerDigits: 0,
			maxIntegerDigits: 14,
			minFractionDigits: 0,
			maxFractionDigits: 5,
			emptyString : null
		});
		return numberFormat.format(number);
	}

	function addPurposesToProduct(productDetails, dynamicPurposes) {
		if(!productDetails || productDetails.length === 0){
			return productDetails;
		}
		productDetails = jQuery.extend(true, [], productDetails);
		Object.keys(productDetails).forEach(function(prodId) {
			dynamicPurposes.forEach(function(purpose){
				if(!productDetails[prodId][purpose]) {
					productDetails[prodId][purpose] = false;
				}
			});
		});
		return productDetails;
	}
	
	function calculateMassChangeSelectionModel(productDetails){
		if(!productDetails || productDetails.length === 0){
			return {};
		}
		return productDetails.reduce(function(result, currentDetail){
			var resultProps = Object.keys(result);
			
			resultProps.forEach(function(prop){
				if(result[prop] !== currentDetail[prop]){
					delete result[prop];
				}
			});
			
			return result;
		});
	}
	
	function reformatNumericValues(selectionData){
		return Object.keys(selectionData).reduce(function(result, key){
			var currentValue = selectionData[key];
			if(jQuery.isNumeric(currentValue)){
				result[key] = formatNumber(currentValue);
			}else {
				result[key] = currentValue;
			}
			return result;
		}, {});
	}
	
	
	function calculateMassChangeDataModel(updateHandler, productDetails, prepolulatedFields){
		var unitsOfMeasure = productDetails.map(function(productDetails){
			return productDetails.UnitOfMeasures;
		}).filter(Utils.identity);
	
		var result = {};
		result.UnitOfMeasures = commonUnitsOfMeasure(unitsOfMeasure);
		result.CurrencyList = productDetails.CurrencyList || [];
		return result; 
	}
	
	var NON_NUMERIC_FIELDS = ["LockUserProjection"];
	
	function isNotNumeric(field, dynamicPurposes) {
		return NON_NUMERIC_FIELDS.concat(dynamicPurposes).indexOf(field) !== -1;
	}
	
	function ProductDetailsMassChangeHandler(productDetailsHandler, productDetails, editableFields, enforceMultiple){
		this.updateHandler = productDetailsHandler;
		this.productDetails = productDetails || []; 
		this.editableFields = editableFields;
		this.enforceMultiple = enforceMultiple;
	}
	
	
	function createChangeList(productDetails, changes, selections, editableFields, dynamicPurposes){
		var cleanChanges = {};
		
		editableFields.forEach(function(field){
			if (isNotNumeric(field, dynamicPurposes)) {
				cleanChanges[field] = (changes[field] && changes[field] !== "false") || changes[field] === "true" ? true : false;
			} else {
				cleanChanges[field] = changes[field];	
			}
			
		});
		
		return productDetails.map(function(detail){
			var result = {};
			editableFields.forEach(function(field){
				if(!selections[field + "Selected"]){
					return;
				}
				if(isNotNumeric(field, dynamicPurposes)) {
					result[field] = cleanChanges[field];
				} else if(isNaN(parseNumber(cleanChanges[field]))){
					result[field] = cleanChanges[field];
				}else {
					result[field] = parseNumber(cleanChanges[field]) + "";
				}
			});
			result.Index = detail.Index;
			return result;
		}); 
		
	}
	
	
	function sameDiscountType(productDetails){
		return productDetails.every(function(detail, index, allDetails){
			return detail.DiscountType === allDetails[0].DiscountType;
		});
	}
	
	
	function basicDiscountValidation(property, changeList, productDetails){
		
		var discountType = productDetails[0].DiscountType;
		var discountTypeLabel = productDetails[0].DiscountTypeLabel;
		var discountValue = changeList[0][property] ? parseNumber(changeList[0][property]) : null;
		
		if(!discountType && discountValue !== null){
			return [{
				Type : "NoDiscountTypeError",
				Property : property
			}];
		}
		
		if(discountType === "05" || discountType === "06"){
			return [{
				Type : "FreeAndEDLPValidationError",
				Text : discountTypeLabel,
				Property : property
			}];
		}
		
		if(discountType === "04") {
			if(discountValue < 0 || discountValue > 100 ){
				return [{
					Type : "DiscountPercentOffValidationError",
					Property : property
				}];
			}
		}else {
			if(discountValue < 0 ){
				return [{
					Type : "RegularValueValidationError",
					Property : property
				}];
			}
			
			if(isNaN(discountValue)){
				return [{
					Type : "IsNaNValidationError",
					Property : property
				}];
			}
			
		}
		
		return [];
	}
	

	function validateDiscountValue(changeList, productDetails){
		var validateDiscounts = !!changeList[0].DiscountValue;
		var sameType = sameDiscountType(productDetails);
		if(validateDiscounts && !sameType){
			return [{
				Type : "DiscountTypeError",
				Property : "DiscountValue"
			}];
		}
		return basicDiscountValidation("DiscountValue", changeList, productDetails);
	}
	
	
	function validateSubDiscountValue(changeList, productDetails, enforceMultiple){
		var validateDiscounts = !!changeList[0].SubDiscountValue;
		var sameType = sameDiscountType(productDetails);
		if(!validateDiscounts){
			return [];
		}
		
		if(!sameType){
			return [{
				Type : "DiscountTypeError",
				Property : "SubDiscountValue"
			}];
		}
		
		if(enforceMultiple !== "I"){
			return [{
				Type : "EnforceMultipleValidationError",
				Property : "SubDiscountValue"
			}].concat(basicDiscountValidation("SubDiscountValue", changeList, productDetails));
		}
		
		return basicDiscountValidation("SubDiscountValue", changeList, productDetails);
	}
	
	function flattenConfigs(productDetails){
		return productDetails.reduce(function(result, detail){
			return jQuery.extend(true, result, detail.Config);
		}, {});
	}
	
	function flattenChangeList(changeList){
		return changeList[0]; // this is fine since all changes are of the same structure.
	}
	
	function isDisabledByConfig(change, configObject){
		return change && (!configObject.Editable || !configObject.Visible);
	}
	
	function validateByConfiguration(changeList, productDetails){
		var config = flattenConfigs(productDetails);
		var changeItem = flattenChangeList(changeList);
		
		return Object.keys(config).reduce(function(errors, key){
			var configObject = config[key];
			var change = changeItem[key];
			
			if(isDisabledByConfig(change, configObject)){
				errors.push({
					Type : "ConfigError",
					Property : key
				});
			}
			return errors;
		}, []);
	}
	
	
	function validateOtherProperties(changeList, productDetails){
		var change = changeList[0];
		var properties = ["UserProjection", "DisplayUoMValue", "PromoCostPrice"];
		
		return properties.reduce(function(errors, currentProperty){
			var currentValueString = change[currentProperty];
			
			if(!currentValueString){
				return errors;
			}
			var currentValue = parseFloat(currentValueString);
			
			if(currentValue < 0) {
				errors.push({
					Type : "RegularValueValidationError",
					Property : currentProperty
				});
			}
			
			if(isNaN(currentValue)){
				errors.push({
					Type : "IsNaNValidationError",
					Property : currentProperty
				});
			}
			
			return errors;
		}, []);
	}
	
	ProductDetailsMassChangeHandler.prototype.validate = function(changeList){
		var productDetails = this.productDetails;
		var enforceMultiple = this.enforceMultiple;
		return new Promise(function(resolve){
			if(changeList.length === 0 || productDetails.length === 0){
				return resolve([]);
			}
			
			var errors = [];
			
			errors = errors.concat(validateDiscountValue(changeList, productDetails));
			errors = errors.concat(validateSubDiscountValue(changeList, productDetails, enforceMultiple));
			errors = errors.concat(validateByConfiguration(changeList, productDetails));
			errors = errors.concat(validateOtherProperties(changeList, productDetails));
			
			return resolve(errors);
		});
	};
	
	function displayErrors(errors, fn){
		MessageBox.error(errors.reduce(function(message, error){
			return message + fn(error) + "\n";
		}, ""));
	}
	
	ProductDetailsMassChangeHandler.prototype.openDialog = function(){
		var editableFields = this.editableFields;
		var productDetails = this.productDetails;
		var updateHandler = this.updateHandler;
		var i18n = Utils.getI18NModel();
		
		var allPurposes = updateHandler.model.getProperty("/AllPurposes") || [];
		var dynamicPurposes = [];
		var that = this;
		
		function errorMessageFormatter(error){
				var errorType = error.Type;
				var errorProperty = error.Property || "";
				var textAttribute = error.Text || "";
				
				var bundle = i18n.getResourceBundle();
				var errorMessage = bundle.getText("ManageOffer.ProductDetail.Error." + errorType);
				var propertyName = bundle.getText("ManageOffers.ProductDetails." + errorProperty);
				
				var formatParams = [propertyName];
				
				if(textAttribute){
					formatParams.push(textAttribute);
				}
				
				return jQuery.sap.formatMessage(errorMessage, formatParams);
		}
		
		function changeValidator(property){
			return function(e){
				var changesModel = fragment.getModel();
				
				var selectionModel = {};
				selectionModel[property + "Selected"] = true;
				
				var source = e.getSource();
				var changes = createChangeList(productDetails, changesModel.getData(), selectionModel, editableFields, this.dynamicPurposes);
				that.validate(changes).then(function(errors){
					var formattedErrors = errors.map(errorMessageFormatter);
					if(formattedErrors.length > 0){
						source.setValueState("Error");
						source.setValueStateText(formattedErrors.join(" \n"));
					}else {
						source.setValueState("None");
						source.setValueStateText(null);
						var number = parseNumber(changesModel.getProperty("/" + property));
						changesModel.setProperty("/" + property, formatNumber(number));
					}
				});
			};
		} 
		
		var controller = {
			close : function(){
				fragment.close();
				fragment.destroy();
			},
			
			ok : function(){
				var changesModel = fragment.getModel();
				var selectionModel = fragment.getModel("Data");
				var changes = createChangeList(productDetails, changesModel.getData(), selectionModel.getData(), editableFields, this.dynamicPurposes);
				
				that.validate(changes).then(function(errors){
					if(errors.length > 0){
						displayErrors(errors, errorMessageFormatter);
					}else{
						updateHandler.massChange(changes);
						this.close();
					}
				}.bind(this));
			},
			cancel : function(){
				this.close();
			}
		};
		
		function addDinamicallyPurposes(fragment, purpose) {
			var value = "_PURPOSE_" + purpose.Id;
			dynamicPurposes.push(value);
			var grid =  new sap.ui.layout.Grid({
				width: "100%",
				defaultSpan: "L12 M12 S12",
				hSpacing: 1,
				content: [ new sap.m.ComboBox({
						selectedKey: "{/" + value + "}",
						width: "100%",
						items:[
						    new sap.ui.core.Item({
						    	key: true,
						    	text: i18n.getResourceBundle().getText("CreateOffer.MassEdit.Yes")
						    }),
						    new sap.ui.core.Item({
						    	key: false,
						    	text: i18n.getResourceBundle().getText("CreateOffer.MassEdit.No")
						    })
						],
						layoutData: new sap.ui.layout.GridData({ span: "L10 M10 S10" }),
						id: "PURPOSE_ID_" + purpose.Id
					}),
					new sap.m.CheckBox({
						layoutData: new sap.ui.layout.GridData({ span: "L2 M2 S2" }),
						selected:"{Data>/" + value + "Selected}"
					})	
				]
			}).addStyleClass("gridInVerticalLayout");
			var layout = new sap.ui.layout.VerticalLayout({
				width:"100%",
				content:[ new sap.m.Label({
						text: purpose.Name,
						labelFor: "PURPOSE_ID_" + purpose.Id
					}).addStyleClass("sapUiSmallMarginBegin"),
					grid
				]
			});
			fragment.addContent(layout);
		}
		
		editableFields.forEach(function(field){
			controller["validate" + field] = changeValidator(field);
		});
		var fragment = sap.ui.xmlfragment("retail.pmr.promotionaloffers.plugins.terms.controls.freestyle.DetailsMassChangeDialog", controller);
		
		fragment.open();
		
		allPurposes.forEach(function(purpose){
			addDinamicallyPurposes(fragment, purpose);
		});
		controller.dynamicPurposes = dynamicPurposes;
		editableFields = editableFields.concat(dynamicPurposes);
		var prepolulatedFileds = reformatNumericValues(calculateMassChangeSelectionModel(addPurposesToProduct(productDetails, dynamicPurposes)));
		var staticContent = calculateMassChangeDataModel(updateHandler, productDetails, prepolulatedFileds);


		fragment.setModel(i18n, "i18n");
		fragment.setModel(new JSONModel(prepolulatedFileds));
		fragment.setModel(new JSONModel(staticContent), "Data");
		
		return fragment;
		
	};
	
	return ProductDetailsMassChangeHandler;
	
}, true);
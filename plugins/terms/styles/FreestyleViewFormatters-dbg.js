/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["retail/pmr/promotionaloffers/utils/Utils"], function(Utils){
	var notNull = Utils.notNull;

	var INCENTIVE_MORE_PROPERTIES = [ "AdjustedValue", "Value", "AdjustedCost", "Cost", "RedemptionRate" ];

	var TERM_MORE_PROPERTIES = [ "PromoCostPrice" ];

	function contains(values, value){
		return values.indexOf(value) >= 0;
	}

	function and(a, b){
		return a && b;
	}
	
	function or(a, b){
		return a || b;
	}
	
	function booleanFormatter(/* ...args */) {
		var args = Array.prototype.splice.call(arguments, 0);
		return args.filter(notNull).reduce(and, true);
	}
	
	function seeMoreVisible(properties, configProp, object, financialsAvailable, extraConditions) {
		var configs = properties.map(function(property) {
			return Utils.get(object, [configProp, property, "Visible"]);
		});

		var anyVisibleConfig = configs.filter(function(config) {
			if (notNull(config)) {
				return config;
			}
			return true;
		}).reduce(or, false);

		return booleanFormatter.apply(this, [ financialsAvailable === "X" ].concat(extraConditions)) && anyVisibleConfig;
	}
	
	function detailsSubDiscountFormatter(editable, hasDiscount, enforceMultiple, packageOffer, discountType, config) {
		if (editable === false) {
			return false;
		}

		if (packageOffer === true) {
			return false;
		}

		if (discountType === "05" || discountType === "06") {
			return false;
		}

		if (config) {
			return config.Editable && config.Visible;
		}

		return enforceMultiple === "I" && !!hasDiscount;
	}
	
	return {
		INCENTIVE_MORE_PROPERTIES : INCENTIVE_MORE_PROPERTIES,
		TERM_MORE_PROPERTIES : TERM_MORE_PROPERTIES,
		
		productComboFormatter : function(dimensionType, productIdConfig, hierarchyNodeIdConfig, hierarchyIdConfig){
			if(dimensionType === "20"){
				return false;
			}
			
			if(contains(["01", "11", "12"], dimensionType)){
				return notNull(productIdConfig) ? productIdConfig : true; 
			}
			
			if(contains(["02", "03"], dimensionType)){
				var config = hierarchyNodeIdConfig || hierarchyIdConfig;
				return notNull(config) ? config : true;
			}
			
			return true;
		},
		percentageFormatter: function(percentage){
			var oNumberFormat = sap.ui.core.format.NumberFormat.getFloatInstance({
			  maxFractionDigits: 2,
			  groupingEnabled: false
			});
			return oNumberFormat.format(percentage || 0) + " %";
		},
		quantityUoMFormatter : function(dimensionType, quanityConfig, uomConfig){
			if(dimensionType === "20"){
				return false;
			}
			quanityConfig = notNull(quanityConfig) ? quanityConfig : true;
			uomConfig = notNull(uomConfig) ? uomConfig : true;
			return quanityConfig || uomConfig;
		},
		quanitySizeFormatter : function(quanityConfig, uomConfig){
			quanityConfig = notNull(quanityConfig) ? quanityConfig : true;
			uomConfig = notNull(uomConfig) ? uomConfig : true;
			
			if(quanityConfig && uomConfig){
				return "L9 M9 S9";
			}
			if(quanityConfig){
				return "L12 M12 S12";
			}
			return "L9 M9 S9";
		},
		uomSizeFormatter : function(quanityConfig, uomConfig){
			quanityConfig = notNull(quanityConfig) ? quanityConfig : true;
			uomConfig = notNull(uomConfig) ? uomConfig : true;
			
			if(quanityConfig && uomConfig){
				return "L3 M3 S3";
			}
			if(uomConfig){
				return "L12 M12 S12";
			}
			return "L3 M3 S3";
		},
		
		quanityUoMLabelFormatter : function(fullText, quantityText, uomText, quanityConfig, uomConfig){
			quanityConfig = notNull(quanityConfig) ? quanityConfig : true;
			uomConfig = notNull(uomConfig) ? uomConfig : true;
			
			if(quanityConfig && uomConfig){
				return fullText;
			}
			if(quanityConfig){
				return quantityText;
			}
			
			if(uomConfig){
				return uomText;
			}
			return fullText;
		},
		inputSize6 : function(feature, bVisible) {
			var isNull = !notNull(bVisible);
			if (feature === "X" && (isNull || bVisible)) {
				return "L6 M6 S6";
			} else {
				return "L12 M12 S12";
			}
		},
		termBlockSize: function(feature) {
			if (feature === "X") {
				return "L4 M12 S12";
			} else {
				return "L6 M12 S12";
			}
		},
		labelFormatter : function(bVisible1, sVal1, bVisible2, sVal2) {
			function formatValue(array, bIsVisible, sVal) {
				var isNull = !notNull(bIsVisible);
				if (isNull || bIsVisible) {
					array.push(sVal);
				}
			}

			var value = [];
			formatValue(value, bVisible1, sVal1);
			formatValue(value, bVisible2, sVal2);

			return value.join(" / ");
		},
		
		booleanFormatter : booleanFormatter,
		promoCostPriceVisiblityFormatter : function(dimension, financials, config, seeMore){
			return booleanFormatter(dimension !== "12", financials === "X", config, seeMore);
		},
		
		userProjectionFormatter : function(editable, upEditable, packageOffer){
			return booleanFormatter(editable, upEditable, !packageOffer);
		},
		
		packageOfferBooleanFormatter : function() {
			var args = Array.prototype.splice.call(arguments, 0);
			var packageOffer = !args[0];
			args.shift();

			return booleanFormatter.apply(this, [ packageOffer ].concat(args));
		},
		
		featureFormatter : function(featureAvailable) {
			var args = Array.prototype.splice.call(arguments, 1);
			return booleanFormatter.apply(this, [ featureAvailable === "X" ].concat(args));
		},
		
		quantityTextFormatter: function (quantity, uom) {
			var oNumberFormat = sap.ui.core.format.NumberFormat.getFloatInstance({
				maxFractionDigits: 3,
				groupingEnabled: false
			});
			var valFormatted = oNumberFormat.format(quantity || 0);
			return !uom ? valFormatted : valFormatted + " / " + uom;
		},

		promoCostPriceCurrencyVisiblityFormatter : function(version, config, seeMore, editContent){
			return booleanFormatter(version > 3, config, seeMore, editContent);
		},
		
		promoCostPriceTextFormatter: function (version, promoCost, currency) {
			var oNumberFormat = sap.ui.core.format.NumberFormat.getFloatInstance({
				maxFractionDigits: 5,
				groupingEnabled: false
			});
			var valFormatted = oNumberFormat.format(promoCost || 0);
			if (version > 3 && currency) {
				return valFormatted + " / " + currency;
			}
			return valFormatted;
		},	
	
		discountTextFormatter: function (value, description) {						
			var oNumberFormat = sap.ui.core.format.NumberFormat.getFloatInstance({
				maxFractionDigits: 5,
				groupingEnabled: false
			});
			var valFormatted = oNumberFormat.format(value || 0);
			return !description ? valFormatted : valFormatted + " " + description;
		},

		discountVarietyHiddenFormatter : function(dimension, configVisible) {
			return booleanFormatter(dimension !== "01", configVisible);
		},
		
		seeMoreVisible : seeMoreVisible,
		termsSeeMoreVisible : function(object, financialsAvailable /* , ... extraConditions */) {
			var extraConditions = Array.prototype.splice.call(arguments, 2);
			var goodDimension = object.Selection.DimensionType !== "12";
			extraConditions.push(goodDimension);
			return seeMoreVisible(TERM_MORE_PROPERTIES, "ProductConfig", object, financialsAvailable, extraConditions);
		},
		incentivesSeeMoreVisible : function(object, financialsAvailable /* , ... extraConditions */) {
			var extraConditions = Array.prototype.splice.call(arguments, 2);
			return seeMoreVisible(INCENTIVE_MORE_PROPERTIES, "Config", object, financialsAvailable, extraConditions);
		},
		
		detailsSubDiscountFormatter : detailsSubDiscountFormatter,
		detailsDiscountFormatter : function(editable, hasDiscount, packageOffer, discountType, config) {
			return detailsSubDiscountFormatter(editable, hasDiscount, "I", packageOffer, discountType, config);
		}
	};
}, true);
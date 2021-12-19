/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([], function() {
	"use strict";
	
	var oCalculator = {
		
		extendFinancials: function(oFin) {
			//Extend financials with additional calculated properties
			if (!oFin) {
				return;
			}
			
			// Forecast Uplift = Promo Forecast - Forecast Baseline
			oFin.ForecastUplift = oFin.SystemForecast - oFin.SystemForecastBaseline;
			
			if (!jQuery.isNumeric(oFin.ForecastUplift)) {
				oFin.ForecastUplift = null;
				oFin.ForecastUpliftPer = null;	
			} else {
				var fUnit = oFin.SystemForecastBaseline / 100;
				if (fUnit !== 0) {
					oFin.ForecastUpliftPer = oFin.ForecastUplift / fUnit;
				} else {
					oFin.ForecastUpliftPer = 0;	
				}
			}
			
		}
		
	};
	
	return oCalculator;
	
}, /* bExport= */ true);
/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([],function(){"use strict";var c={extendFinancials:function(f){if(!f){return;}f.ForecastUplift=f.SystemForecast-f.SystemForecastBaseline;if(!jQuery.isNumeric(f.ForecastUplift)){f.ForecastUplift=null;f.ForecastUpliftPer=null;}else{var u=f.SystemForecastBaseline/100;if(u!==0){f.ForecastUpliftPer=f.ForecastUplift/u;}else{f.ForecastUpliftPer=0;}}}};return c;},true);

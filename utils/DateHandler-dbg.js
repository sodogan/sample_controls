/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["sap/ui/base/EventProvider",
               "retail/pmr/promotionaloffers/utils/Utils"], function(EventProvider, Utils){
	var DateHandler = EventProvider.extend("retail.pmr.promotionaloffers.utils.DateHandler", {
		metadata : {
			events : "dateChanged"
		},
		constructor: function() {
			EventProvider.prototype.constructor.apply(this, arguments);
            this._startDate = null;
            this._endDate = null;
            this._startTime = null;
            this._endTime = null;
            this._prevStartDate = null;
            this._prevEndDate = null;
            this._prevStartTime = null;
            this._prevEndTime = null;
        },
        
		startDateChanged: function(value, valid) {
			if(!(valid && value)) {
				this.fireEvent("dateChanged");
				return;
			}
			this.setPrevStartDate(this.getStartDate());
			var start = DateHandler.getDate(value, this.getStartTime());
			this.setStartDate(start);
			
			if(this.getEndDate().getTime() > this.getPrevStartDate().getTime()) {
				this.adaptEndDate(start);
			}else{
				this.setPrevEndDate(this.getEndDate());
			}
			this.fireEvent("dateChanged");			
		},
		
		endDateChanged: function(value, valid) {
			if(!(valid && value)) {
				this.fireEvent("dateChanged");
				return;
			}
			this.setPrevEndDate(this.getEndDate());
			this.setEndDate(DateHandler.getDate(value, this.getEndTime()));
			this.setPrevStartDate(this.getStartDate());
			this.fireEvent("dateChanged");			
		},
		
		startTimeChanged: function(value) {
			this.setPrevStartTime(this.getStartTime());
			this.setStartTime(new Date(value));
			this.setStartDate(DateHandler.getDate(this.getStartDate(), this.getStartTime()));
			this.adaptEndTime();
			this.fireEvent("dateChanged");
			
		},
		
		endTimeChanged: function(value) {
			this.setPrevEndTime(this.getEndTime());
			this.setEndTime(new Date(value));
			this.setEndDate(DateHandler.getDate(this.getEndDate(), this.getEndTime()));
			this.setPrevStartTime(this.getStartTime());
			this.fireEvent("dateChanged");
		},
		
		 getCombinedStartDate: function(){
			var date = this.getStartDate();
			var time = this.getStartTime();
			return DateHandler.getDate(date, time);
		},
		
		getCombinedEndDate:function(){
			var date = this.getEndDate();
			var time = this.getEndTime();
			return DateHandler.getDate(date, time);
		},
		
		getCombinedPrevStartDate: function(){
			var date = this.getPrevStartDate();
			var time = this.getPrevStartTime();
			return DateHandler.getDate(date, time);
		},
		
		getCombinedPrevEndDate: function(){
			var date = this.getPrevEndDate();
			var time = this.getPrevEndTime();
			return DateHandler.getDate(date, time);
		},
		
		updateVersions: function(model){
			var versions = model.getData().Versions;
			(versions || []).forEach(DateHandler.updateRangeIfSame(this), this);	
			sap.ui.getCore().getEventBus().publish("retail.pmr.promotionaloffers", "updateVersions", {versions: versions});
			model.refresh(true);
		},
		
		updateTactics : function(dataModel, timeModel) {
			
			var oStartOfOffer = this.getStartDate();
			var oEndOfOffer = this.getEndDate();
			var prevStartDate = this.getPrevStartDate();
			var prevEndDate = this.getPrevEndDate();
			var prevStartTime = this.getPrevStartTime();
			var prevEndTime = this.getPrevEndTime();
			
			var aTactics = dataModel.getData().Tactics || [];
			
			var oTimeData = timeModel.getData();

			var oChange = {
					StartOfTactic: function(oTactic) {
						var oDate = DateHandler.getDate(oTactic.StartOfTactic, prevStartDate);
						if (oDate.getTime() === prevStartDate.getTime()) {
							oTactic.StartOfTactic = DateHandler.getDate(oStartOfOffer, oTactic.StartOfTactic);
						}
					},

					EndOfTactic: function(oTactic) {
						var oDate = DateHandler.getDate(oTactic.EndOfTactic,prevEndDate);
						if (oDate.getTime() === prevEndDate.getTime()) {
							oTactic.EndOfTactic = DateHandler.getDate(oEndOfOffer, oTactic.EndOfTactic);
						}
					},

					StartTimeOfTactic: function(oTactic) {
						if(!oTactic.StartTimeOfTactic || DateHandler.getTime(oTactic.StartTimeOfTactic).getTime() === DateHandler.getTime(prevStartTime).getTime()) {
							oTactic.StartTimeOfTactic = oTimeData.StartTime;
							oTactic.StartOfTactic = DateHandler.getDate(oTactic.StartOfTactic, oTactic.StartTimeOfTactic);
							oTactic.StartTimeOfTacticValue = this.getFormatTimePiker(oTactic.StartTimeOfTactic);
						}

					}.bind(this),

					EndTimeOfTactic: function(oTactic) {
						if(!oTactic.EndTimeOfTactic || DateHandler.getTime(oTactic.EndTimeOfTactic).getTime() === DateHandler.getTime(prevEndTime).getTime()) {
							oTactic.EndTimeOfTactic = oTimeData.EndTime;
							oTactic.EndOfTactic = DateHandler.getDate(oTactic.EndOfTactic, oTactic.EndTimeOfTactic);
							oTactic.EndTimeOfTacticValue = this.getFormatTimePiker(oTactic.EndTimeOfTactic);
						}
					}.bind(this)
			};
			Object.getOwnPropertyNames(oChange).forEach(function(target){
				aTactics.forEach(function(oTactic) {
					oChange[target](oTactic);
				});
			});

			dataModel.refresh(true);
		},
		
		adaptEndDate: function(oStartOfOffer) {
			var oEndOfOffer = this.getEndDate();
			if (!oEndOfOffer) {
				return;
			}
			this.setPrevEndDate(oEndOfOffer);
			var oPreviousStartOfOffer = this.getPrevStartDate();
			var iDifference = oEndOfOffer.getTime() - oPreviousStartOfOffer.getTime();
			var oNewEndOfOffer = new Date(oStartOfOffer.getTime() + iDifference);
			if(oNewEndOfOffer.getTimezoneOffset() != oEndOfOffer.getTimezoneOffset()){
				iDifference = oNewEndOfOffer.getTimezoneOffset() - oEndOfOffer.getTimezoneOffset();
				oNewEndOfOffer = new Date(oNewEndOfOffer.getTime() + iDifference * 60000);
			}
			if(oStartOfOffer.getTimezoneOffset() != oPreviousStartOfOffer.getTimezoneOffset()){
				iDifference = oStartOfOffer.getTimezoneOffset() - oPreviousStartOfOffer.getTimezoneOffset();
				oNewEndOfOffer = new Date(oNewEndOfOffer.getTime() - iDifference * 60000);
			}
			this.setEndDate(oNewEndOfOffer); 
		},
	
		adaptEndTime: function() {
			var oPreviousStartTime = this.getPrevStartTime();
			var endTime = this.getEndTime();
			var startTime = this.getStartTime();
			var endDate = this.getEndDate();
			var iDifference = endTime.getTime() - oPreviousStartTime.getTime();
			var oNewEndTime = new Date(startTime.getTime() + iDifference);
			var oEndOfOffer = new Date(endDate.getTime() + (oNewEndTime.getTime() - endTime.getTime()));
			
			this.setPrevEndTime(endTime);
			this.setPrevEndDate(endDate);
			
			this.setEndTime(oNewEndTime);
			this.setEndDate(oEndOfOffer);
		},
		
		onAllDaySelect: function() {
			var startTime = new Date(this.getStartTime());
   			var endTime = new Date(this.getEndTime());
   			this.setPrevStartTime(this.getStartTime());
   			this.setPrevEndTime(this.getEndTime());
   			this.setPrevEndDate(this.getEndDate());
   			
   			this.setPrevStartDate(this.getStartDate());
   			
   			this.setStartTime(new Date(startTime.setHours(0, 0, 0, 0)));
   			this.setStartDate(DateHandler.getDate(this.getStartDate(), this.getStartTime()));
   			
			this.setEndTime(new Date(endTime.setHours(23, 59, 59, 0)));
			this.setEndDate(DateHandler.getDate(this.getEndDate(), this.getEndTime()));		
			
   			this.fireEvent("dateChanged");
		},
		
		getFormatTimePiker: (function(){
			var oTimePicker = new sap.m.TimePicker();
			return function(time){
				if(!time) {
					return "";
				}
				return oTimePicker._formatValue(time);
			};
		}()),
		
		setStartDate: function(value) {
			this._startDate = value;
		},
		
		setEndDate: function(value) {
			this._endDate = value;
		},
		
		setStartTime: function(value) {
			this._startTime = value;
		},
		
		setEndTime: function(value) {
			this._endTime = value;
		},
		
		setPrevStartDate: function(value) {
			this._prevStartDate = value;
		},
		
		setPrevEndDate: function(value) {
			this._prevEndDate = value;
		},
		
		setPrevStartTime: function(value) {
			this._prevStartTime = value;
		},
		
		setPrevEndTime: function(value) {
			this._prevEndTime = value;
		},
		
		getStartDate: function() {
			return this._startDate;
		},
		
		getEndDate: function() {
			return this._endDate;
		},
		
		getStartTime: function(value) {
			return this._startTime;
		},
		
		getEndTime: function(value) {
			return this._endTime;
		},
		
		getPrevStartDate: function(value) {
			return this._prevStartDate;
		},
		
		getPrevEndDate: function(value) {
			return this._prevEndDate;
		},
		
		getPrevStartTime: function(value) {
			return this._prevStartTime;
		},
		
		getPrevEndTime: function(value) {
			return this._prevEndTime;
		}
	});
	
	DateHandler.updateRangeIfSame = function updateRangeIfSame(dateHandler){
		var startDate = dateHandler.getCombinedStartDate();
		var endDate = dateHandler.getCombinedEndDate();
		
		var prevStartDate = dateHandler.getCombinedPrevStartDate() || startDate;
		var prevEndDate = dateHandler.getCombinedPrevEndDate() || endDate;

		return function(version){
			var startOfVersion = version.StartOfOffer.getTime();
			var prevStartDateTime = prevStartDate.getTime();
			
			var endOfVersion = version.EndOfOffer.getTime();
			var prevEndDateTime = prevEndDate.getTime();
			
			
			if (startOfVersion === prevStartDateTime){
				version.StartOfOffer = new Date(startDate.getTime());
			}
			
			if(endOfVersion === prevEndDateTime){
				version.EndOfOffer = new Date(endDate.getTime());
			}
			
			return version;	
		};
	};
	
	DateHandler.getDate = function(oDate, oTime) {
		if (!oDate || !oTime) {
			return oDate;
		}
		var oDateResult = new Date(oDate.getTime());
		oDateResult.setHours(oTime.getHours(), oTime.getMinutes(), oTime.getSeconds(), 0);
		return oDateResult;
	};
		
	DateHandler.getTime = function(oDate) {
		var oResult = new Date(0);
		oResult.setHours(oDate.getHours());
		oResult.setMinutes(oDate.getMinutes());
		oResult.setSeconds(oDate.getSeconds());
		return oResult;
	};
	
	return DateHandler;
	
});
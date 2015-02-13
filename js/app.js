(function() {
  var App;

  App = (function() {
    function App(options) {
      var defaults = {};
      this.options = $.extend(defaults, options);
      this.init();  
    }   
    
    App.prototype.init = function(){
      var _this = this;
      
      this.player_loaded = new $.Deferred();
      
      $.when(this.player_loaded).done(function() {
        _this.loadInterviews();
      });
      
      this.loadSlider();
      this.loadSoundManager();            
      this.addListeners();      
    };
    
    App.prototype.addInterviewToUI = function(interview, index){
      var $button = $('<button class="interview" data-i="'+index+'" data-id="'+interview.id+'">'+interview.name+'</button>');
      $('#interviews').append($button);
    };
    
    App.prototype.addListeners = function(){
      var _this = this;
      
      $('#interviews').on('click', '.interview', function(e){
        e.preventDefault();
        var i = $(this).attr('data-i');
        
        _this.loadInterviewByIndex(i);
      });
      
      $('.toggle-audio').on('click', function(e){
        $(this).toggleClass('active');
        
        _this.toggleAudio();
      });
      
      $('.toggle-midi').on('click', function(e){
        $(this).toggleClass('active');
        
        _this.toggleMidi();
      });
      
    };
    
    App.prototype.loadInterviewByIndex = function(i){
      var _this = this,
          interview = this.interviews[i];
      
      // Interview not found
      if (!interview) return;     
      
      // stop current interview
      this.stop();
      $('.player').removeClass('active').addClass('loading');
      
      // audio not loaded
      if (!interview.player) {
        this.interviews[i].player = soundManager.createSound({
          url: interview.audio_url,
          autoLoad: true,
          autoPlay: false,
          onload: function() {
            console.log('loaded audio: '+interview.name);
            _this.loadInterviewByIndex(i);
          }
        });
      
      // midi not loaded
      } else if (!interview.midi_player) {
        this.interviews[i].midi_player = soundManager.createSound({
          url: interview.midi_url,
          autoLoad: true,
          autoPlay: false,
          onload: function() {
            console.log('loaded midi: '+interview.name);
            _this.loadInterviewByIndex(i);
          }
        });
      
      // sequence not loaded
      } else if (!interview.sequence) {
        console.log('loading sequence: '+interview.sequence_url);
        $.getJSON(interview.sequence_url, function(data){
          console.log('loaded sequence: '+interview.name);
          _this.interviews[i].sequence = data;
          _this.loadInterviewByIndex(i);
        });
        
      // audio is ready
      } else {
        
        this.loadInterview(interview);
        
      }      
        
    };
    
    App.prototype.loadInterview = function(interview){      
      // set current intervew
      this.current_interview = interview;  
      
      // update links
      var $link = $('.interview[data-id="'+interview.id+'"]');      
      $('.interview').removeClass('active');
      $link.addClass('active');
      
      // update slider
      var duration = interview.player.duration;
      $("#player-slider").slider( "option", "max", duration);
      $("#player-slider").slider( "option", "values", [ Math.round(duration/2-1000), Math.round(duration/2+1000) ] );
      
      // make ui active
      $('.player').removeClass('loading').addClass('active');
    };
    
    App.prototype.loadInterviews = function(){
      var _this = this;
      
      this.interviews = [];
      
      $.getJSON('data/interviews.json', function(data){
        var interviews = data.interviews;
        console.log('loaded '+interviews.length+' interviews.');
        
        _this.interviews = interviews;
        $('#interviews').removeClass('loading');
        
        _.each(interviews, function(interview, i){
          _this.addInterviewToUI(interview, i);
        });
        
      });
    };
    
    App.prototype.loadSlider = function(){
      var _this = this;
      
      $("#player-slider").slider({
        range: true,
        min: 0,
        max: 1000,
        step: 1,
        values: [475, 575],
        change: function(event, ui) {
          if (_this.player_timeout) {
            clearTimeout(_this.player_timeout);
          }
          _this.play(ui.values[0], ui.values[1]);
          _this.showSequence(ui.values[0], ui.values[1]);
        }
      });
    };
    
    App.prototype.loadSoundManager = function(){
      var _this = this;
      
      soundManager.setup({
        url: 'swf/',
        flashVersion: 9,
        preferFlash: false,
        onready: function() {
          console.log('loaded soundmanager.');          
          _this.player_loaded.resolve();  
        }
      });
    };
    
    App.prototype.play = function(start, stop){
      if (!this.current_interview) return;
      
      var _this = this;    
        
      this.toggleAudio();
      this.toggleMidi();
      
      // go to position and play audio
      this.current_interview.player.setPosition(start);
      if (this.current_interview.player.playState !== 1)
        this.current_interview.player.play();
      
      this.current_interview.midi_player.setPosition(start);
      if (this.current_interview.midi_player.playState !== 1)
        this.current_interview.midi_player.play();
        
      // loop
      this.player_timeout = setTimeout(function(){
        _this.play(start, stop);
      }, stop - start);
    };
    
    App.prototype.showSequence = function(start, stop){
      if (!this.current_interview) return;
      
      var $container = $('#player-sequence');      
      $container.empty();
      
      var seq = _.filter(this.current_interview.sequence, function(step){ return step.ms >= start && (step.ms + step.dur) < stop; });
      _.each(seq, function(step){
        $container.append($('<div class="step">'+step.note+'</div>'));
      });
    };
    
    App.prototype.stop = function(){
      if (this.player_timeout) {
        clearTimeout(this.player_timeout);
      }
          
      if (this.current_interview) {
        this.current_interview.player.stop();
        this.current_interview.midi_player.stop();
      }
    };
    
    App.prototype.toggleAudio = function(){
      if (!this.current_interview) return;
      
      var audio = $('.toggle-audio').hasClass('active');        
        
      // toggle audio volume
      if (!audio) {
        this.current_interview.player.mute();
      } else {
        this.current_interview.player.unmute();
      }
    };
    
    App.prototype.toggleMidi = function(){
      if (!this.current_interview) return;
      
      var midi = $('.toggle-midi').hasClass('active');        
      
      if (!midi) {
        this.current_interview.midi_player.mute();
      } else {
        this.current_interview.midi_player.unmute();
      }    
    };
    
    App.prototype._floorToNearest = function(value, roundTo) {
      return Math.floor(value / roundTo) * roundTo;
    };
    
    return App;

  })();

  $(function() {
    return new App({});
  });

}).call(this);


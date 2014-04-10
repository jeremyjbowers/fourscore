(function(){
	'use-strict'

	var CONFIG,
			existing_data;

/********************************/

	function range(start, stop, step) {
	  if (arguments.length < 3) {
	    step = 1;
	    if (arguments.length < 2) {
	      stop = start;
	      start = 0;
	    }
	  }
	  if ((stop - start) / step === Infinity) throw new Error("infinite range");
	  var range = [],
	       k = range_integerScale(Math.abs(step)),
	       i = -1,
	       j;
	  start *= k, stop *= k, step *= k;
	  if (step < 0) while ((j = start + step * ++i) > stop) range.push(j / k);
	  else while ((j = start + step * ++i) < stop) range.push(j / k);
	  return range;
	};

	function range_integerScale(x) {
	  var k = 1;
	  while (x * k % 1) k *= 10;
	  return k;
	}	
/********************************/

	function makeGridArray(data, size) {
		var extent;
		// If they haven't specified a custom input range then make it a one-to-one based on grid size
		if (!data.input_extents){
			extent = Math.floor(size/2);
			data.input_extents = [extent * -1, extent];
		}
		var userValueToGridIdx = new Scale(data.input_extents[0], data.input_extents[1], 0, size - 1),
		    grid = range(0,size).map(function(c) { return range(0,size).map(function(b) { return {submission_value: [Math.round(userValueToGridIdx.inverse(b)),Math.round(userValueToGridIdx.inverse(c))], count: 0, ids: []} }) }),
				grid_x,
				grid_y,
				grid_xy,
				max = 0,
				cell;

		for (var i = 0; i < data.submissions.length; i++){
			grid_x = Math.round(userValueToGridIdx(data.submissions[i].x));
			grid_y = Math.round(userValueToGridIdx(data.submissions[i].y));
			grid_xy = [grid_x, grid_y];
			cell = grid[grid_xy[1]][grid_xy[0]];
			cell.count++;
			cell.ids.push(data.submissions[i].uid); 
			if (cell.count > max) max = cell.count;
		}
		return {grid: grid, extents: [0, max]}
	}

	function setSquareFill(extents, val){
		val = Number(val);
		var colorScale = new Scale(extents[0], extents[1], 0, 4) // Use a five color scale for now.
		return 'q' + Math.round(colorScale(val)) + '-5';
	}

	function convertNameToSelector(grid_selector){
		if (typeof grid_selector == 'string') {
			
			if (grid_selector.match(/#?[A-Za-z][A-Za-z0-9_-]+$/)) {
				return $("#" + grid_selector.replace(/^#/,""));
			}

			return $(grid_selector);
		
		}

		//ADD: if it's an element, return $(el);

		return grid_selector;
	}

	function gridArrayToMarkup(grid_selector, color_brewer_style_name, Grid){
		$grid = convertNameToSelector(grid_selector);
		$grid.hide()
				 .addClass(color_brewer_style_name)
				 .addClass('st-grid')
				 .html('');

		var grid = Grid.grid,
				extents = Grid.extents,
				grid_width  = $grid.width(),
			  grid_height = $grid.height(),
			  square_value,
			  submission_value,
			  ids;

		// For every row in the grid, make a row element
		for (var i = 0; i < grid.length; i++ ){
			$('<div class="st-row"></div>').height(grid_height / grid.length)
																	.appendTo($grid);

			// Now make a cell with the aggregate data
			for (var j = 0; j < grid.length; j++){
				square_value = grid[i][j].count;
				submission_value = JSON.stringify(grid[i][j].submission_value);
				ids   = JSON.stringify(grid[i][j].ids)
				$('<div class="st-cell"></div>').width(grid_width / grid.length - 1) // Subtract one for the margin given between cells
																			 .attr('data-submission-value', submission_value)
																			 .attr('data-ids', ids)
																			 .attr('data-cell-id', grid[i][j].submission_value[0] + '-' + grid[i][j].submission_value[1])
																			 .html(square_value)
																			 .addClass(setSquareFill(extents, square_value))
																			 .appendTo($($grid.find('.st-row')[i]));
			}
		}
		$grid.show();

	}

	function submissionsToGridMarkup(subm_data, conf){
		var Grid = makeGridArray(subm_data, conf.grid_size);
		gridArrayToMarkup(conf.grid_selector, conf.color_brewer_style_name, Grid);

	}

	function bindHandlers(){
		$('.st-grid').on('mouseover', '.st-cell', function(){
			var $this = $(this);
			console.log('Input submission: ', $this.attr('data-submission-value'))
		});

		$('.st-grid').on('mouseleave', function(){
			/* HIDE TOOLTIP */
		});

		$('.st-grid').on('click', '.st-cell', function(){
			var $this = $(this);
			var selected_id = $this.attr('data-cell-id');
			var submission_values = JSON.parse($this.attr('data-submission-value'));
			var nv = {
				x: submission_values[0],
				y: submission_values[1]
			}

			console.log(nv);
			/* PROMPT FROM SUBMISSION */
			formSubmit(nv, selected_id)
		});
	}

	function formSubmit(new_data, selected_id){
		existing_data.submissions.push(new_data);
		updateGrid(existing_data);
		// Highlight that cell we clicked on, now that everything is redrawn
		$('.st-cell[data-cell-id="'+selected_id+'"]').addClass('st-selected');
	}

	function updateGrid(new_data){
		submissionsToGridMarkup(new_data, CONFIG);
	}

  function submissionsToCommentsMarkup(data, config){
    var submissions = data.submissions,
        extent      = data.input_extents[1], // Find the range to later calc the percentage of this comment
        $comments_container = convertNameToSelector(config.comments_selector);

    var commentTemplateFactory = _.template($('#st-comment-template').html()),
        comment_markup;

    // Hide it so that it renders faster
    $comments_container.hide();
    // Add comments
    for (var i = 0; i < submissions.length; i++) {
      comment_markup = commentTemplateFactory(submissions[i]);
      $comments_container.append(comment_markup);
    }

    // This would normally work using the range being 0 to 100
    // But you have to take into account the width of the circle
    // So subtract the dimensions of the circle (as a percentage of the total mini-map dimentions)
    var map_width = $('.st-mini-map').width();
    var map_height = $('.st-mini-map').height();
    
    // Make a dummy circle first so we can measure its dimensions
    $('body').append('<div class="st-mm-dot"></div>')
    var dot_width_perc  = $('.st-mm-dot').width() / map_width * 100;
    var dot_height_perc = $('.st-mm-dot').height() / map_height * 100;

    var userValueToCssPercentageLeft = new Scale(-1, 1, 0, (100  - dot_width_perc));
    var userValueToCssPercentageTop = new Scale(-1, 1, 0, (100 - dot_height_perc));

    // Remove the dummy circle
    $('.st-mm-dot').remove();
    
    // Make the map
    $('.st-mini-map').each(function(i, el){
      var $el = $(el),
          x_pos = $el.attr('data-x') / extent,
          y_pos = $el.attr('data-y') / extent;

      $el.append('<div class="st-mm-quadrant"></div>')
         .append('<div class="st-mm-quadrant"></div>')
         .append('<div class="st-mm-quadrant"></div>')
         .append('<div class="st-mm-quadrant"></div>');

      $('<div class="st-mm-dot"></div>')
         .css('left', userValueToCssPercentageLeft(x_pos) + '%')
         .css('top', userValueToCssPercentageTop(y_pos) + '%').appendTo($el);

    })
    // Once the appends are done, show it
    $comments_container.show();
  }

	function createViz(data){
    // Create the Grid Viz!
		submissionsToGridMarkup(data, CONFIG);

    // Create the comments section
    submissionsToCommentsMarkup(data, CONFIG);

		//ADD: only bind if they haven't submitted?
		bindHandlers();

	}

	/*

    Generate a form element based on a form item in the config options.

    Returns a <div> with a label and whatever the element is.
    
    The element is one of:

    a <textarea>
    a <select> with <option>s,
    an <input> (for type="text", type="number", etc.)
    a <div> with several <inputs> (for type="radio" or type="checkbox")

  */
  function getFormElement(item) {

    var $el,
        $outer = $("<div></div>");

    $outer.append("<label>" + item.name + "</label>");

    if (item.type == "textarea") {

      $el = $("<textarea></textarea>")
              .attr("name",item.field);
    
    } else if (item.type == "select") {
      $el = $("<select></select>")
              .attr("name",item.field);

      $.each(item.choices,function(i,c){
        
        $el.append(

          $("<option></option>").text(c)

        );

      });

    } else if (item.type == "radio" || item.type == "checkbox") {

      $el = $("<div></div>");

      $.each(item.choices,function(i,c){

        var $i = $("<input/>").attr({
              "name": item.field,
              "type": item.type,
              "value": c
            }),
            $s = $("<span/>").text(c);

        $el.append($i);
        $el.append($s);

      });
    } else {

      $el = $("<input/>").attr({
        "name": item.field,
        "type": item.type,
        "value": ""
      });

    }

    $outer.append($el);

    return $outer;

  }

  /*
    Called upon successful form submission
  */
  function submitted() {

    try {

      //Big random number into localStorage to mark that they submitted it
      localStorage.setItem("st-id", Math.floor(Math.random()*999999999));

    } catch(e) {}

    //Take hover/click listeners off the grid

  }

  function stageData(gridData,config) {
    gridData = $.map(gridData,function(d){
      d.x = ("x" in d) ? +d.x : +d.X;
      d.y = ("y" in d) ? +d.y : +d.Y;
      return d;
    });

    existing_data = {submissions: gridData};

    // Create the Grid
    createViz(existing_data,config);

  }

  /*
    Initialize everything from a set of config options
  */
  function initFromConfig(rawConfig) {

  	CONFIG = rawConfig;

    var $form = $("div#form form"),
        $iframe = $("iframe#st-iframe");

    if (CONFIG.dataSource.type == "google") {

      Tabletop.init({ key: CONFIG.dataSource.url,
        callback: function(data) {
            stageData(data,CONFIG);
          },
        simpleSheet: true
      });

    } else if (CONFIG.dataSource.type == "json") {
      $.getJSON(CONFIG.dataSource.url,function(data){
        stageData(data,CONFIG);
      });
    } else {
      $.get(CONFIG.dataSource.url,function(data){
        //Need to pick a parser for this
        //stageData(csv2json(data),CONFIG);
      });
    }

    //Don't populate the form or set listeners if they already submitted
    try {
      //Temporarily false to always draw the form
      if (localStorage.getItem("st-id") && false) return true;
    } catch (e) {}

    //Add the listener for the iframe that will get the submission
    $iframe.on("load",submitted);

    //Set the form action
    $form.attr("action",CONFIG.dataDestination)
          .on("submit",function(){
            //When they submit, check for missing required fields
            $(".missing").removeClass("missing");

            var $missing = $.map(CONFIG.fields,function(f){

              var tag = (f.type == "select" || f.type == "textarea") ? f.type : "input",
                  $tag = $(tag + "[name='" + f.field + "']");



              if (f.required && (!$tag.val() || !$tag.val().length)) {
                return $tag;
              }

              return false;

            });

            $missing = $.grep($missing,function(f){
              return f !== false;
            });

            if ($missing.length) {

              $.each($missing,function(i,$m){

                $m.addClass("missing");

              });

              return false;
            }

            return true;

          });

    //Create the form fields
    $.each(CONFIG.fields,function(i,f){
      $form.append(getFormElement(f));
    });

    //Append a submit button
    $form.append("<input type=\"submit\" value=\"Submit\"/>");

  }

  //Main initializer
  function sentimentTracker(opt) {
    if (typeof opt == "string") {
      $.getJSON(opt,initFromConfig);
    } else {
      initFromConfig(opt);
    }
  }

  sentimentTracker("sample-form-config.json");


}).call(this);
/* vim: set expandtab sw=4 ts=4 sts=4: */
/**
 * @fileoverview    functions used on the database structure page
 * @name            Database Structure
 *
 * @requires    jQuery
 * @requires    jQueryUI
 * @required    js/functions.js
 */

/**
 * AJAX scripts for db_structure.php
 *
 * Actions ajaxified here:
 * Drop Database
 * Truncate Table
 * Drop Table
 *
 */

/**
 * Adjust number of rows and total size in the summary
 * when emptying or dropping a table
 *
 * @param jQuery object     $this_anchor
 */
function PMA_adjustTotals($this_anchor) {
    var $parent_tr = $this_anchor.closest('tr');
    var $rows_td = $parent_tr.find('.tbl_rows');
    var $size_td = $parent_tr.find('.tbl_size');
    var num_rows = parseInt($rows_td.text());
    // set number of rows to 0
    // (not really needed in case we are dropping the table)
    $rows_td.text('0');
    // set size to unknown (not sure how to get the exact
    // value here, as an empty InnoDB table would have a size)
    $size_td.text('-');

    // try to compute a new total row number
    if (! isNaN(num_rows)) {
        $total_rows_td = $('#tbl_summary_row').find('.tbl_rows');
        var total_rows = parseInt($total_rows_td.text());
        if (! isNaN(total_rows)) {
            $total_rows_td.text(total_rows - num_rows);
        }
    }

    // prefix total size with "~"
    var $total_size_td = $('#tbl_summary_row').find('.tbl_size');
    $total_size_td.text($total_size_td.text().replace(/^/,'~'));
}

$(document).ready(function() {
    /**
     * Ajax Event handler for 'Insert Table'
     *
     * @uses    PMA_ajaxShowMessage()
     * @see     $cfg['AjaxEnable']
     */
    var currrent_insert_table;
    $("td.insert_table a.ajax").live('click', function(event){
        event.preventDefault();
        currrent_insert_table = $(this);
        var url = $(this).attr("href");
        if (url.substring(0, 15) == "tbl_change.php?") {
             url = url.substring(15);
        }

       	var div = $('<div id="insert_table_dialog"></div>');
       	var target = "tbl_change.php";

        /**
         *  @var    button_options  Object that stores the options passed to jQueryUI
         *                          dialog
         */
        var button_options = {};
        // in the following function we need to use $(this)
        button_options[PMA_messages['strCancel']] = function() {$(this).parent().dialog('close').remove();}

        var button_options_error = {};
        button_options_error[PMA_messages['strOK']] = function() {$(this).parent().dialog('close').remove();}

        var $msgbox = PMA_ajaxShowMessage();

        $.get( target , url+"&ajax_request=true" ,  function(data) {
            //in the case of an error, show the error message returned.
            if (data.success != undefined && data.success == false) {
                div
                .append(data.error)
                .dialog({
                    title: PMA_messages['strInsertTable'],
                    height: 230,
                    width: 900,
                    open: PMA_verifyTypeOfAllColumns,
                    buttons : button_options_error
                })// end dialog options
            } else {
                div
                .append(data)
                .dialog({
                    title: PMA_messages['strInsertTable'],
                    height: 600,
                    width: 900,
                    open: PMA_verifyTypeOfAllColumns,
                    buttons : button_options
                })
                //Remove the top menu container from the dialog
                .find("#topmenucontainer").hide()
                ; // end dialog options
                $(".insertRowTable").addClass("ajax");
                $("#buttonYes").addClass("ajax");
            }
            PMA_ajaxRemoveMessage($msgbox);
        }) // end $.get()

    });

    $("#insertForm .insertRowTable.ajax input[value=Go]").live('click', function(event) {
        event.preventDefault();
        /**
         *  @var    the_form    object referring to the insert form
         */
        var $form = $("#insertForm");
        $("#result_query").remove();
        PMA_prepareForAjaxRequest($form);
        //User wants to submit the form
        $.post($form.attr('action'), $form.serialize() , function(data) {
            if(data.success == true) {
                PMA_ajaxShowMessage(data.message);
            } else {
                PMA_ajaxShowMessage(data.error);
            }
            if ($("#insert_table_dialog").length > 0) {
                $("#insert_table_dialog").dialog("close").remove();
            }
            /**Update the row count at the tableForm*/
            currrent_insert_table.closest('tr').find('.value.tbl_rows').html(data.row_count);
        }) // end $.post()
    }) // end insert table button "Go"

    $("#buttonYes.ajax").live('click', function(event){
        event.preventDefault();
        /**
         *  @var    the_form    object referring to the insert form
         */
        var $form = $("#insertForm");
        /**Get the submit type and the after insert type in the form*/
        var selected_submit_type = $("#insertForm").find("#actions_panel .control_at_footer option:selected").attr('value');
        var selected_after_insert = $("#insertForm").find("#actions_panel select[name=after_insert] option:selected").attr('value');
        $("#result_query").remove();
        PMA_prepareForAjaxRequest($form);
        //User wants to submit the form
        $.post($form.attr('action'), $form.serialize() , function(data) {
            if(data.success == true) {
                PMA_ajaxShowMessage(data.message);
                if (selected_submit_type == "showinsert") {
                    $(data.sql_query).insertAfter("#topmenucontainer");
                    $("#result_query .notice").remove();
                    $("#result_query").prepend((data.message));
                }
                if (selected_after_insert == "new_insert") {
                    /**Trigger the insert dialog for new_insert option*/
                    currrent_insert_table.trigger('click');
                }

            } else {
                PMA_ajaxShowMessage(data.error);
            }
            if ($("#insert_table_dialog").length > 0) {
                $("#insert_table_dialog").dialog("close").remove();
            }
            /**Update the row count at the tableForm*/
            currrent_insert_table.closest('tr').find('.value.tbl_rows').html(data.row_count);
        }) // end $.post()
    });

    /**
     * Ajax Event handler for 'Truncate Table'
     *
     * @uses    $.PMA_confirm()
     * @uses    PMA_ajaxShowMessage()
     * @see     $cfg['AjaxEnable']
     */
    $(".truncate_table_anchor").live('click', function(event) {
        event.preventDefault();

        /**
         * @var $this_anchor Object  referring to the anchor clicked
         */
        var $this_anchor = $(this);

        //extract current table name and build the question string
        /**
         * @var curr_table_name String containing the name of the table to be truncated
         */
        var curr_table_name = $this_anchor.parents('tr').children('th').children('a').text();
        /**
         * @var question    String containing the question to be asked for confirmation
         */
        var question = 'TRUNCATE ' + curr_table_name;

        $this_anchor.PMA_confirm(question, $this_anchor.attr('href'), function(url) {

            PMA_ajaxShowMessage(PMA_messages['strProcessingRequest']);

            $.get(url, {'is_js_confirmed' : 1, 'ajax_request' : true}, function(data) {
                if (data.success == true) {
                    PMA_ajaxShowMessage(data.message);
                    //Fetch inner span of this anchor
                    //and replace the icon with its disabled version
                    var span = $this_anchor.html().replace(/b_empty.png/, 'bd_empty.png');
                    PMA_adjustTotals($this_anchor);

                    //To disable further attempts to truncate the table,
                    //replace the a element with its inner span (modified)
                    $this_anchor
                        .replaceWith(span)
                        .removeClass('truncate_table_anchor');
                } else {
                    PMA_ajaxShowMessage(PMA_messages['strErrorProcessingRequest'] + " : " + data.error);
                }
            }) // end $.get()
        }) //end $.PMA_confirm()
    }); //end of Truncate Table Ajax action

    /**
     * Ajax Event handler for 'Drop Table'
     *
     * @uses    $.PMA_confirm()
     * @uses    PMA_ajaxShowMessage()
     * @see     $cfg['AjaxEnable']
     */
    $(".drop_table_anchor").live('click', function(event) {
        event.preventDefault();

        var $this_anchor = $(this);

        //extract current table name and build the question string
        /**
         * @var $curr_row    Object containing reference to the current row
         */
        var $curr_row = $this_anchor.parents('tr');
        /**
         * @var curr_table_name String containing the name of the table to be truncated
         */
        var curr_table_name = $curr_row.children('th').children('a').text();
        /**
         * @var question    String containing the question to be asked for confirmation
         */
        var question = 'DROP TABLE ' + curr_table_name;

        $this_anchor.PMA_confirm(question, $this_anchor.attr('href'), function(url) {

            PMA_ajaxShowMessage(PMA_messages['strProcessingRequest']);

            $.get(url, {'is_js_confirmed' : 1, 'ajax_request' : true}, function(data) {
                if (data.success == true) {
                    PMA_ajaxShowMessage(data.message);
                    PMA_adjustTotals($this_anchor);
                    $curr_row.hide("medium").remove();

                    if (window.parent && window.parent.frame_navigation) {
                        window.parent.frame_navigation.location.reload();
                    }
                } else {
                    PMA_ajaxShowMessage(PMA_messages['strErrorProcessingRequest'] + " : " + data.error);
                }
            }); // end $.get()
        }); // end $.PMA_confirm()
    }); //end of Drop Table Ajax action

    /**
     * Ajax Event handler for 'Drop tracking'
     *
     * @uses    $.PMA_confirm()
     * @uses    PMA_ajaxShowMessage()
     * @see     $cfg['AjaxEnable']
     */
    $('.drop_tracking_anchor').live('click', function(event) {
        event.preventDefault();

        var $anchor = $(this);

        /**
         * @var curr_tracking_row   Object containing reference to the current tracked table's row
         */
        var curr_tracking_row = $anchor.parents('tr');
         /**
         * @var question    String containing the question to be asked for confirmation
         */
        var question = PMA_messages['strDeleteTrackingData'];

        $anchor.PMA_confirm(question, $anchor.attr('href'), function(url) {

            PMA_ajaxShowMessage(PMA_messages['strDeletingTrackingData']);

            $.get(url, {'is_js_confirmed': 1, 'ajax_request': true}, function(data) {
                if(data.success == true) {
                    PMA_ajaxShowMessage(data.message);
                    $(curr_tracking_row).hide("medium").remove();
                }
                else {
                    PMA_ajaxShowMessage(PMA_messages['strErrorProcessingRequest'] + " : " + data.error);
                }
            }) // end $.get()
        }) // end $.PMA_confirm()
    }) //end Drop Tracking

    //Calculate Real End for InnoDB
    /**
     * Ajax Event handler for calculatig the real end for a InnoDB table
     *
     * @uses    $.PMA_confirm
     */
    $('#real_end_input').live('click', function(event) {
        event.preventDefault();

        /**
         * @var question    String containing the question to be asked for confirmation
         */
        var question = PMA_messages['strOperationTakesLongTime'];

        $(this).PMA_confirm(question, '', function() {
            return true;
        })
        return false;
    }) //end Calculate Real End for InnoDB

}, 'top.frame_content'); // end $(document).ready()

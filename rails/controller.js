
Rails.mapURI = function( uri ){
    
    var mime = MimeTypes.get( uri );
    
    if ( (  mime && 
            ( mime.startsWith( "image/" ) 
              || mime.startsWith( "video/" )
            ) )
         ||
         uri.match( /\.(css|js)$/ )
       )
        return "/public" + uri;
         
    return "/~~/rails/rails.jxp";
};

ActionController.Base = function(){
    this.shortName = null;
    this.className = null;
};

ActionController.Base.prototype.__magic = 17;

ActionController.Base.prototype.dispatch = function( request , response , matchingRoute ){

    var f = this[matchingRoute.action];
    if ( ! f ){
        print( "can't find [" + matchingRoute.action + "] in [" + this.className + "]" );
        return;
    }
    
    var appResponse = new ApplicationResponse( this , matchingRoute.action );

    // --- setup scope
    
    var funcScope = f.getScope( true );

    funcScope.render_text = function(s){
        print( s );
        appResponse.anythingRendered = true;
    };
    
    funcScope.respond_to = function( b ){
        b.call( appResponse.requestThis , appResponse );
    };

    funcScope.redirect_to = function( thing ){
        appResponse.anythingRendered = true;
        print( "<script>window.location = \"" + Rails.routes.getLinkFor( thing ) + "\";</script>" );
        return true;
    };
    
    // --- invoke action

    f.call( appResponse.requestThis );
    
    if ( ! appResponse.anythingRendered ){
        /*
        if ( ! local.app.views )
            throw "no views directory";
        
        if ( ! local.app.views[ this.shortName ] )
            throw "no views directory for " + this.shortName;
        
        var viewName = Rails.unmangleName( matchingRoute.action );
        

        var view = local.app.views[ this.shortName ][viewName];
        if ( ! view )
            view = local.app.views[ this.shortName ][viewName + ".html" ];
        if ( ! view )
            throw "no view for " + this.shortName + "." + viewName;
        
        view.call( appResponse.requestThis );
*/
        appResponse.html();
    }

    print( "\n <!-- " + this.className + "." + method + " -->" );
};

ActionController.Base.prototype.toString = function(){
    return "{ shortName : " + this.shortName + " , className : " + this.className + " }";
};



function ApplicationResponse( controller , method ){

    this.controller = controller;
    assert( this.controller );

    this.method = method;
    assert( this.method );

    this.anythingRendered = false;

    this.requestThis = {};
    this.requestThis.prototype = controller;
};

ApplicationResponse.prototype.html = function(){
    if ( arguments.length > 0 && 
         isFunction( arguments[ arguments.length - 1 ] ) ){
        return arguments[arguments.length-1].call( this );
    }
    var blah = this.requestThis;

    blah.__notFoundHandler = function( thing ){
        if ( thing.endsWith( "_path" ) ){
            return function(z){
                return "BROKEN : " + z;
            }
        }
        return null;
    }


    if ( ! local.app.views )
        throw "no views directory";
    
    if ( ! local.app.views[ this.controller.shortName ] )
        throw "no view directory for : " + this.controller.shortName;
   
    var viewName = Rails.unmangleName( this.method );
    
    var template = 
        local.app.views[ this.controller.shortName ][ viewName + ".html" ] || 
        local.app.views[ this.controller.shortName ][ viewName  ];
    
    if ( ! template )
        throw "no template for " + this.controller.shortName + ":" + viewName;
    log.rails.response.debug( template + ".html" + called );
    

    if ( Rails.helpers.application ){
        Object.extend( this.requestThis , Rails.helpers.application );
        SYSOUT ( "HERE : " + this.requestThis.keySet() );
    }
    
    if ( Rails.helpers[ this.controller.shortName ] ){
        Object.extend( this.requestThis , Rails.helpers[ this.controller.shortName ] );
    }

    if ( arguments.length > 0 && isFunction( arguments[0] ) ){
        arguments[0].call( this.requestThis );
    }

    
    // layout

    var layout = null;
    if ( local.app.views.layouts ){
        layout = 
            local.app.views.layouts[ this.controller.shortName + ".html" ] || 
            local.app.views.layouts.application || 
            local.app.views.layouts["application.html"];
    }
    
    SYSOUT( "layout : " + layout );
    if ( layout ){
        
        layout.getScope( true ).controller = { action_name : this.method }; // ???
        
        this.requestThis.content_for( "layout" , template );
        assert( this.requestThis.content_for_layout != null );
        
        layout.call( this.requestThis ,
                     function(  name ){
                         if ( name )
                             return blah["content_for_" + name ]
                         return blah.content_for_layout;
                     }
                   );
    }
    else {
        template.apply( blah );
    }
        
    this.anythingRendered = true;
};

ApplicationResponse.prototype.xml = function(){
    return false;
};


// ---------
// data model
// ---------

function caches_page( name ){
    SYSOUT( "ignore caches_page [" + name + "]" );
};

function before_filter( name ){
    SYSOUT( "ignore before_filter [" + name + "]" );
};
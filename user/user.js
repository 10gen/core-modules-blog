// FIXME: hash (username, email) and -> not duplicating

/**
 * User
 *   email
 *   url
 *   name
 *   nickname
 *   firstname, lastname (optional)
 * FIXME: use better names for these fields?
 * name -> username, nickname -> displayname
 */

User.prototype.setPassword = function( pass , name ){
    if ( ! name )
        name = db.getName();
    this.pass_ha1_name = md5( this.name + ":" + name + ":" + pass );
    this.pass_ha1_email = md5( this.email + ":" + name + ":" + pass );
};

User.prototype.checkPasswordClearText = function( pass ){
    if ( this.pass_ha1_name == md5( this.name + ":" + db.getName() + ":" + pass ) )
        return true;

    if ( this.pass_ha1_email == md5( this.email + ":" + db.getName() + ":" + pass ) )
        return true;

    return false;
};

User.prototype.checkPasswordDigest = function( pass ){
    if ( this.pass_ha1_name == pass )
         return true;
    if ( this.pass_ha1_email == pass )
        return true;
    return false;
};

User.prototype.isAdmin = function(){
    return this.hasPermission( "admin" );
};


User.prototype.hasPermission = function( perm ){
    if ( ! this.permissions )
        return false;

    return this.permissions.contains( perm.toLowerCase() ) || this.permissions.contains( "superadmin" );
};

User.prototype.addPermission = function( perm ){
    if ( ! this.permissions )
        this.permissions = Array();
    this.permissions.push( perm.toLowerCase() );
};

User.prototype.removePermission = function( perm ){
    if ( ! this.permissions )
        return;
    var i = this.permissions.indexOf(perm);
    if ( i == -1 )
        return;
    this.permissions.splice(i, 1);
};

User.prototype.getDisplayName = function( ){
    return this.nickname;
};

User.find = function( thing , theTable ){
    if ( ! theTable )
        theTable = db.users;

    theTable.setConstructor( User );

    if ( ! thing )
        return null;

    var u = { length: function(){ return 0; } }; // or DBCursor to db.users
    if ( thing.match( /@/ ) )
        u = theTable.find( { email : thing } );

    if ( u.length() == 0 )
        u = theTable.find( { name : thing } );

    if ( u.length() == 0 && theTable.base != "admin" && thing.match( /@10gen.com/ ) )
        return User.find( thing , db[".admin.users"] );

    if ( u.length() == 0 ) return null;

    if ( u.length() != 1 ) throw "duplicate users for " + thing;

    return u[0];
};

if ( db ){
    db.users.setConstructor( User );

    db.users.ensureIndex( { email : 1 } );
    db.users.ensureIndex( { name : 1 } );
    db.users.ensureIndex( { permissions : 1 } );
}

User.statusName = function(status){
    if(status == "confirmed_email")
        return "confirming your email";

};

User.statusLink = function(status){
    if(status == "confirmed_email")
        return new URL(User.findMyLocation()+"confirm_send").toString()
};


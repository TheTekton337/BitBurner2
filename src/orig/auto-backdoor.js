/** @param {NS} ns */
export async function main( ns )
{
  /*prevent arrays being passed by reference, 
    pass by value instead: array1.push( JSON.parse( JSON.stringify( array2 ) ) )*/

  ns.disableLog( "ALL" );

  var scannedServers;
  var server;
  var homePaths = [["home"]];
  var homePath = JSON.parse( JSON.stringify( homePaths [0] ) );
  var newNode;
  var path;
  var pathDuplicate;
  var pathNode;
  var nodeDuplicate;
  var terminalInput = eval( 'document.getElementById( "terminal-input" )' ); /*bypass document*/
  var terminalHandler = Object.keys( terminalInput )[1];
  var hackingLevel = ns.getHackingLevel();

  /*create an array of all paths where each path is also an array,
     all paths are from "home" to each server, example:
     [["home"], ["home", "n00dles"], ["home", "n00dles", "zer0"], ["home ", "foodnstuff"]]
  This structure will make terminal input easier.
  Example: terminal:>connect home;connect n00dles;connect zer0;
  Also, connect home; works from any server which make these paths universal*/

  while( homePath.length !== 0 ) 
  {
    scannedServers = ns.scan( homePath [homePath.length - 1] );
    newNode = false;
    for( server of scannedServers )
    {
      nodeDuplicate = false;
      for( pathNode of homePath )
      {
        if( JSON.stringify( pathNode ) === JSON.stringify( server ) )
        {
          nodeDuplicate = true;
          break;
        }
      }

      if( nodeDuplicate === false )
      {
        homePath.push( server );
        pathDuplicate = false;
        for( path of homePaths )
        {
          if( JSON.stringify( path ) === JSON.stringify( homePath ) )
          {
            pathDuplicate = true;
            break;
          }
        }

        if( pathDuplicate === false )
        {
          homePaths.push( JSON.parse( JSON.stringify( homePath ) ) );
          newNode = true;
          break;
        }
        else
        {
          homePath.pop( );
        }
      }
    }

    if( newNode === false )
    {
      homePath.pop( );
    }
  }

  for( path of homePaths ) /*install backdoors on servers not owned which have root access*/
  {
    server = ns.getServer( path [path.length - 1] );
    if( ( server.backdoorInstalled === false ) && ( server.purchasedByPlayer === false ) && 
      ( ns.hasRootAccess ( server.hostname ) === true ) && ( hackingLevel > ns.getServerRequiredHackingLevel(server.hostname) ) )
    {
      terminalInput = eval( 'document.getElementById( "terminal-input" )' );
      if( terminalInput === null ) /*exit script if focus is not on terminal window*/
      {
        ns.exit( );
      }
      terminalHandler = Object.keys( terminalInput )[1];
      terminalInput.value = "";
      for( pathNode of path )
      {
        terminalInput.value += "connect " + pathNode + ";"
      }
      terminalInput [terminalHandler].onChange( { target:terminalInput } );
      terminalInput [terminalHandler].onKeyDown( { key:'Enter', preventDefault:() => null } );
      await ns.sleep( 1000 );

      terminalInput = eval( 'document.getElementById( "terminal-input" )' );
      if( terminalInput === null )
      {
        ns.exit( );
      }
      terminalInput.value = "backdoor";
      terminalInput [terminalHandler].onChange( { target:terminalInput } );
      terminalInput [terminalHandler].onKeyDown( { key:'Enter', preventDefault:() => null } );
      /*backdoortime = hacktime / 4*/
      await ns.sleep( Math.ceil( ns.getHackTime( server.hostname ) / 4 ) + 1000 );
    }
  }
  ns.tprint( "Backdoors completed" );
}
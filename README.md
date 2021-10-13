# Known Issues

## General
* Games that no longer have a store page cannot be put on your watchlist, because the steam-api request fails.  
  (I guess this is okay, since you couldn't add those to your steam wishlist either?)

## Highlighting on "entered giveaways" page does not apply for these games:
This is because the steam-api appName is different from the steamgifts name / steam-store name.  
Highlighting still applies when searching for giveaways, as these are based on the appID.  

Ideally name comparison could be avoided altogether, but SG does not provide the appID when browsing entered GAs  
(and I don't want to flood their servers by loading the underlying GA site)

|Steam API|Steamgifts|
|:-------:|:--------:|
|'MAGICKA: PECULIAR GADGETS ITEM PACK DLC '|'Magicka: Peculiar Gadgets Item Pack'|
|'MAGICKA: MEGA VILLAIN ROBES DLC'|'Magicka: Mega Villain Robes'|
|'DuckTales Remastered'|'DuckTales: Remastered'|
|'Redeemer'|'Redeemer: Enhanced Edition'|
|'Odyssey - The Invention of Science'|'Odyssey - The Story of Science'|
|'Thief of Thieves: Season One'|'Thief of Thieves'|